import {format, parseISO} from 'date-fns';
import axios from 'axios';
import {SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";
import jwt from "jsonwebtoken";

const client = new SecretsManagerClient({region: "us-east-1"});

async function getPrivateKey() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: "Salesforce-Private-SSL-Key"
        });

        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error("Secret String for private key is empty or undefined");
        }

        return response.SecretString;
    } catch (error) {
        console.error("Error retrieving Salesforce private key");
        throw error;
    }
}

/**
 * Prints all of the Field Names and Field Labels that are available for the given Salesforce Objects API
 * 
 * @param {String} objectName - the name of the Salesforce Object (ex "Lead", "Contact", "Account")
 * @param {JSON} tokenData - the JSON webtoken
 * @returns {JSON} - response.data
 */
async function verifySalesforceSchema(objectName, tokenData) {
    try {
        const instanceUrl = tokenData.instance_url || 'https://orgfarm-b10ac254af-dev-ed.develop.my.salesforce.com';

        const response = await axios.get(
            `${instanceUrl}/services/data/v61.0/sobjects/${objectName}/describe`,
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        console.log(`Fields for ${objectName}`);
        response.data.fields.forEach(field => {
            console.log(`${field.name}: ${field.label}`);
        })

        return response.data;
    } catch (error) {
        console.error("Error verifying Salesforce schema:", error);
        throw error;
    }
}

/**
 * Securely retreives the Salesforce consumer key, private key, username, and login url
 * 
 * @returns secrets - the JSON object with the four values
 */
async function getSalesforceSecrets() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: "arn:aws:secretsmanager:us-east-1:182486377871:secret:Salesforce-API-Credentials-adUbms"
        });
    
        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error("Secret String is empty or undefined");
        }

        const secrets = JSON.parse(response.SecretString);
        
        const privateKey = await getPrivateKey();

        return {
            consumerKey: secrets.consumerKey,
            privateKey: privateKey,
            username: secrets.username,
            loginUrl: secrets.loginUrl
        };
    } catch (error) {
        console.error("Error retreiving Salesforce credentials:", error);
        throw error;
    }
};

/**
 * Makes an API call to Salesforce to get a temporary access token
 * 
 * @returns res.data - the JSON object with the Salesforce access token, instance url, id, and token type
 */
async function getSalesforceAccessToken() {
    try {
        const salesforceCredentials = await getSalesforceSecrets();

        const consumerKey = salesforceCredentials.consumerKey;
        const privateKey = await getPrivateKey();
        const reformattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        console.log("Reformatted Private Key: " + reformattedPrivateKey.substring(0, 50));
        const username = salesforceCredentials.username;
        const loginUrl = salesforceCredentials.loginUrl;

        const jwtQuery = {
            iss: consumerKey,
            sub: username,
            aud: loginUrl,
            exp: Math.floor(Date.now() / 1000) + (3 * 60)                               // the token will expire after 3 minutes
        };

        const signedJWT = jwt.sign(jwtQuery, reformattedPrivateKey, {algorithm: 'RS256'});

        const res = await axios.post(
            `${loginUrl}/services/oauth2/token`,
            new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': signedJWT
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log("Received response for Salesforce access token");

        return res.data;
    } catch (error) {
        console.error("Error retreiving Salesforce access token:", error);
        throw error;
    }
};

/**
 * Gets the corresponding Salesforce State Code for the given state name
 * 
 * @param {String} state - the full name of the state
 * @returns {String} stateDict[state] - the corresponding Salesforce State Code
 */
function getStateCode(state) {
    const stateDict = {
        "Alabama": "AL",
        "Alaska": "AK",
        "American Samoa": "AS",
        "Arizona": "AZ",
        "Arkansas": "AR",
        "California": "CA",
        "Colorado": "CO",
        "Connecticut": "CT",
        "Delaware": "DE",
        "District of Columbia": "DC",
        "Florida": "FL",
        "Georgia": "GA",
        "Guam": "GU",
        "Hawaii": "HI",
        "Idaho": "ID",
        "Illinois": "IL",
        "Indiana": "IN",
        "Iowa": "IA",
        "Kansas": "KS",
        "Kentucky": "KY",
        "Louisiana": "LA",
        "Maine": "ME",
        "Maryland": "MD",
        "Massachusetts": "MA",
        "Michigan": "MI",
        "Minnesota": "MN",
        "Mississippi": "MS",
        "Missouri": "MO",
        "Montana": "MT",
        "Nebraska": "NE",
        "Nevada": "NV",
        "New Hampshire": "NH",
        "New Jersey": "NJ",
        "New Mexico": "NM",
        "New York": "NY",
        "North Carolina": "NC",
        "North Dakota": "ND",
        "Northern Mariana Islands": "MP",
        "Ohio": "OH",
        "Oklahoma": "OK",
        "Oregon": "OR",
        "Pennsylvania": "PA",
        "Puerto Rico": "PR",
        "Rhode Island": "RI",
        "South Carolina": "SC",
        "South Dakota": "SD",
        "Tennessee": "TN",
        "Texas": "TX",
        "Utah": "UT",
        "Vermont": "VT",
        "Virgin Islands": "VI",
        "Virginia": "VA",
        "Washington": "WA",
        "West Virginia": "WV",
        "Wisconsin": "WI",
        "Wyoming": "WY"
    };

    if (stateDict[state] == null) {
        throw new Error("No state code for state: " + state);
    }

    return stateDict[state]
}

/**
 * Checks if a Lead already exits in Salesforce account with the same first name, last name, and email address
 * 
 * @param {Object} clientData 
 * @param {JWT Object} tokenData 
 * @returns duplicateLeadExists - boolean indicating whether a duplicate lead exists
 */
async function duplicateLeadExits(clientData, tokenData) {
    try {
        const instanceUrl = tokenData.instance_url || 'https://orgfarm-b10ac254af-dev-ed.develop.my.salesforce.com';

        const selectDuplicateQuery = `
            SELECT FirstName, LastName, Email
            FROM Lead
            WHERE FirstName = '${clientData.personal.firstName}'
            AND LastName = '${clientData.personal.lastName}'
            AND Email = '${clientData.contact.email}'
        `;

        const response = await axios.get(
            `${instanceUrl}/services/data/v61.0/query/?q=${encodeURIComponent(selectDuplicateQuery)}`,
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            }
        );

        let duplicateLeadExists = false;

        if (response.data.records.length > 0) {
            duplicateLeadExists = true;
        }

        return duplicateLeadExists;
    } catch (error) {
        console.error("Error checking for duplicate lead:", error);
        throw error;
    }
    
}

/**
 * Creates a new Lead in Salesforce
 * 
 * @param {JSON} clientData 
 * @param {JSON} tokenData 
 * @returns 
 */
async function insertLead(clientData, tokenData) {
    try {
        console.log("Inserting lead");
        const instanceUrl = tokenData.instance_url || 'https://orgfarm-b10ac254af-dev-ed.develop.my.salesforce.com';
        console.log("State: " + clientData.address.stateCode);
        const response = await axios.post(
            `${instanceUrl}/services/data/v61.0/sobjects/Lead`,
            {
                FirstName: clientData.personal.firstName,
                LastName: clientData.personal.lastName,
                Street: clientData.address.streetAddress,
                City: clientData.address.city,
                PostalCode: clientData.address.zipcode,
                CountryCode: "US",
                StateCode: clientData.address.stateCode,
                Phone: clientData.contact.phone,
                Email: clientData.contact.email,
                Primary_Language__c: clientData.contact.primaryLanguage,
                Family_Type__c: clientData.household.familyType,
                Housing_Status__c: clientData.household.housingStatus,
                Household_Size__c: clientData.household.householdSize,
                Estimated_Monthly_Household_Income__c: clientData.household.householdMonthlyIncome,
                Date__c: clientData.dateOfSubmission,
                Company: "Self",
                Status: "Closed - Converted",
                LeadSource: "Fillout"
            },
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data.id;
    } catch (error) {
        console.error("Error inserting lead:", error.response.data);
        throw error;
    };
};

/**
 * 
 * @param {JSON} accountData - all the Fillout answers that pertain to the Account
 * @param {String} leadId - the 18 digit ID of the Lead
 * @param {JSON} tokenData
 * 
 * @returns response.data.id - the Account ID of the newly created Account
 */
async function createAccount(accountData, leadId, tokenData) {
    try {
        const instanceUrl = tokenData.instance_url || 'https://orgfarm-b10ac254af-dev-ed.develop.my.salesforce.com';

        const response = await axios.post(
            `${instanceUrl}/services/data/v61.0/sobjects/Account`,
            {
                Name: `${accountData.firstName} ${accountData.lastName} Household`,
                Primary_Language__c: accountData.primaryLanguage,
                Family_Type__c: accountData.familyType,
                Housing_Status__c: accountData.housingStatus,
                Address__Street__s: accountData.address.streetAddress,
                Address__City__s: accountData.address.city,
                Address__PostalCode__s: accountData.address.zipcode,
                Address__CountryCode__s: "US",
                Address__StateCode__s: accountData.address.stateCode,
                Lead_ID__c: leadId,
                Source__c: "Fillout"
            },
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.id;
    } catch (error) {
        console.error("Error creating Account: ", error.response.data);
        throw error;
    }
}

/**
 * Creates a new Salesforce Contact for each household member entered in the Fillout form
 * 
 * @param {List} householdMembers - the list of household member objects
 * @param {String} leadId - the 18 digit ID of the Lead
 * @param {String} accountId - the Account ID that the Contacts will belong to
 * @param {JSON} tokenData 
 */
async function insertHouseholdMembers(householdMembers, leadId, accountId, tokenData) {
    console.log("Starting insertHouseholdMembers");
    const instanceUrl = tokenData.instance_url || 'https://orgfarm-b10ac254af-dev-ed.develop.my.salesforce.com';
    console.log("Instance URL: " + instanceUrl);

    // Fillout form uses a Yes/No answer for disability questions. Map them to the Salesforce checkbox/boolean options
    const disabledMap = {
        "Yes": true,
        "No": false
    }

    try {
        let phone, email;
        for (let i = 0; i < householdMembers.length; i++) {
            console.log(`Household member ${i+1}: ${householdMembers[i].firstName} ${householdMembers[i].lastName}`)
            if (i == 0) {
                phone = householdMembers[0].phoneNumber;
                email = householdMembers[0].emailAddress;
            }

            console.log("Making axios call");

            const response = await axios.post(
                `${instanceUrl}/services/data/v61.0/sobjects/Contact`,
                {
                    FirstName: householdMembers[i].firstName,
                    LastName: householdMembers[i].lastName,
                    Relationship_to_Head_of_Household__c: householdMembers[i].relationship,
                    Birthdate: householdMembers[i].birthdate,
                    Gender_Identity__c: householdMembers[i].genderIdentity,
                    Race__c: householdMembers[i].race,
                    Hispanic_Status__c: householdMembers[i].ethnicity,
                    Highest_Education_Completed__c: householdMembers[i].highestEducationCompleted,
                    Marital_Status__c: householdMembers[i].maritalStatus,
                    Military_Status__c: householdMembers[i].militaryStatus,
                    Health_Insurance_Coverage__c: householdMembers[i].healthInsuranceCoverage,
                    Disabled__c: disabledMap[householdMembers[i].isDisabled],
                    AccountId: accountId,
                    Lead_ID__c: leadId,
                    Source__c: "Fillout"
                },
                {
                    headers: {
                        'Authorization': `Bearer ${tokenData.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            )
        }
    } catch(error) {
        if (error.response) {
            console.error("Salesforce API error:", error.response.status, error.response.data);
        } else if (error.request) {
            console.error("No response received from Salesforce API:", error.request);
        } else {
            console.error("Error creating Contact: ", error.message);
        }
        throw error;
    }
}

/**
 * 
 * @param {List} questions 
 * @param {String} questionName - the question text ("Member 2 Is Disabled?")
 * @returns 
 */
function getAnswerForQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName);         // find the question with the given name

    if (!questionObj) {
        throw new Error(`Question with name ${questionName} not found`);
    }

    return questionObj.value;                                                               // value is the user's answer to the question
};

export const handler = async (event) => {
    console.log("Triggered");

    const body = JSON.parse(event.body);
    let questions = body.submission.questions;

    const filloutId = body.submission.submissionId;

    const firstName = getAnswerForQuestion(questions, "First Name");
    const lastName = getAnswerForQuestion(questions, "Last Name");
    const email = getAnswerForQuestion(questions, "Email");
    const phone = getAnswerForQuestion(questions, "Phone Number");
    const address = getAnswerForQuestion(questions, "Your address");
    const primaryLanguage = getAnswerForQuestion(questions, "Primary Language");
    const housingStatus = getAnswerForQuestion(questions, "Housing Status");
    const householdSize = getAnswerForQuestion(questions, "Number of members in your household");
    const familyType = getAnswerForQuestion(questions, "Family Type");
    const householdMonthlyIncome = getAnswerForQuestion(questions, "Estimated Monthly Household Income");
    const dateOfSubmission = getAnswerForQuestion(questions, "Date");

    const streetAddress = address.address;
    const city = address.city;
    const state = address.state;
    const stateCode = getStateCode(state);
    const zipcode = address.zipcode;

    let householdMembers = [];
    let client = {}
    client.firstName = firstName;
    client.lastName = lastName;
    client.relationship = "Head of Household";
    client.phone = phone;
    client.email = email;
    client.birthdate = getAnswerForQuestion(questions, "Birthdate");
    client.genderIdentity = getAnswerForQuestion(questions, "Gender Identity");
    client.maritalStatus = getAnswerForQuestion(questions, "Marital Status");
    client.race = getAnswerForQuestion(questions, "Race");
    client.highestEducationCompleted = getAnswerForQuestion(questions, "Highest Education Completed");
    client.militaryStatus = getAnswerForQuestion(questions, "Military Status");
    client.ethnicity = getAnswerForQuestion(questions, "Ethnicity");
    client.isDisabled = getAnswerForQuestion(questions, "Disabled?");
    client.healthInsuranceCoverage = getAnswerForQuestion(questions, "Health Insurance Coverage");
    
    householdMembers.push(client);

    // add any additional househld members to the list
    for (let i = 2; i <= householdSize; i++) {
        let nextMember = {}
        nextMember.firstName = getAnswerForQuestion(questions, `Person ${i} First Name`);
        nextMember.lastName = getAnswerForQuestion(questions, `Person ${i} Last Name`);
        nextMember.birthdate = getAnswerForQuestion(questions, `Person ${i} Birthdate`);
        nextMember.relationship = getAnswerForQuestion(questions, `Person ${i} Relationship to You`);
        nextMember.genderIdentity = getAnswerForQuestion(questions, `Person ${i} Gender Identity`);
        nextMember.maritalStatus = getAnswerForQuestion(questions, `Person ${i} Marital Status`);
        nextMember.race = getAnswerForQuestion(questions, `Person ${i} Race`);
        nextMember.highestEducationCompleted = getAnswerForQuestion(questions, `Person ${i} Highest Education Completed`);
        nextMember.militaryStatus = getAnswerForQuestion(questions, `Person ${i} Military Status`);
        nextMember.ethnicity = getAnswerForQuestion(questions, `Person ${i} Ethnicity`);
        nextMember.isDisabled = getAnswerForQuestion(questions, `Is Person ${i} Disabled?`);
        nextMember.healthInsuranceCoverage = getAnswerForQuestion(questions, `Person ${i} Health Insurance Coverage`);
        householdMembers.push(nextMember);
    }

    console.log("Extracted all form data");

    const clientData = {
        personal: {
            firstName,
            lastName
        },
        contact: {
            email,
            phone,
            primaryLanguage
        },
        address: {
            streetAddress,
            city,
            state,
            stateCode,
            zipcode
        },
        household: {
            housingStatus,
            householdSize,
            familyType,
            householdMonthlyIncome,
        },
        dateOfSubmission
    };

    const accountData = {
        firstName,
        lastName,
        primaryLanguage,
        housingStatus,
        familyType,
        address: {
            streetAddress,
            city,
            state,
            stateCode,
            zipcode
        }
    }

    const tokenData = await getSalesforceAccessToken();

    if (await duplicateLeadExits(clientData, tokenData)) {
        console.log("Duplicate lead exists");
        return {
            statusCode: 200,
            body: JSON.stringify('Duplicate Lead Exists!'),
        };
    }

    console.log("No duplicate exists adding lead");
    const leadId = await insertLead(clientData, tokenData);
    console.log("Lead inserted with id: " + leadId);

    await verifySalesforceSchema("Account", tokenData);

    const accountId = await createAccount(accountData, leadId, tokenData);

    await insertHouseholdMembers(householdMembers, leadId, accountId, tokenData);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Client Loaded to Salesforce Successfully!'),
    };
    return response;
}