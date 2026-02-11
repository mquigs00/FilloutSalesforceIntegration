import {format, parseISO} from 'date-fns';
import axios from 'axios';
import {SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";
import jwt from "jsonwebtoken";

const client = new SecretsManagerClient({region: "us-east-1"});

/**
 * Retrieves the Salesforce private key from Secrets Manager
 * 
 * @returns the Salesforce private key
 */
async function getPrivateKey() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: "arn:aws:secretsmanager:us-east-1:182486377871:secret:Salesforce-Sandbox-Private-Key-ZBweXe"
        });

        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error("Secret String for private key is empty or undefined");
        }

        console.log("Received response for Salesforce private key");

        return response.SecretString;
    } catch (error) {
        console.error("Error retrieving Salesforce private key");
        throw error;
    }
}

/**
 * Logs the name and label of each field for the given Object
 * 
 * @param {string} objectName 
 * @param {string} salesforceAccessToken
 * @returns
 */
async function verifySalesforceSchema(objectName, tokenData) {
    try {
        const instanceUrl = tokenData.instance_url

        const response = await axios.get(
            `${instanceUrl}/services/data/v61.0/sobjects/${objectName}/describe`,
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        // print each field name and label
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
            SecretId: "arn:aws:secretsmanager:us-east-1:182486377871:secret:SF-Sandbox-Credentials-OMWAfi"
        });
    
        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error("Secret String is empty or undefined");
        }

        console.log("Received response for Salesforce credentials");
        const secrets = JSON.parse(response.SecretString);

        const privateKey = await getPrivateKey()

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
        const privateKey = salesforceCredentials.privateKey;
        const reformattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        const username = salesforceCredentials.username;
        const loginUrl = salesforceCredentials.loginUrl;

        console.log("Login URL: " + loginUrl + " Username = " + username);

        const jwtQuery = {
            iss: consumerKey,
            sub: username,
            aud: loginUrl,
            exp: Math.floor(Date.now() / 1000) + (3 * 60)                               // the token will expire after 3 minutes
        };

        const signedJWT = jwt.sign(jwtQuery, reformattedPrivateKey, {algorithm: 'RS256'});
        const decoded = jwt.decode(signedJWT, {complete: true});
        console.log(decoded.payload);

        //console.log("Signed JWT Token: " + JSON.stringify(jwt.decode(signedJWT, {complete: true})));

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
 * Gets the Salesforce state code that corresponds to the full state name
 * 
 * @param {string} state
 * @returns the corresponding two letter state code
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

        // query to check for leads with the same first name, last name, and email address
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
 * Creates the lead in Salesforce
 * 
 * @param {*} clientData
 * @param {*} salesforceAccessToken
 * 
 * @returns the id of the new Lead record
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
                Country: "US",
                State: clientData.address.state,
                Phone: clientData.contact.phone,
                Email: clientData.contact.email,
                Primary_Language__c: clientData.contact.primaryLanguage,
                Household_Size__c: clientData.household.householdSize,
                Estimated_Monthly_Household_Income__c: clientData.household.householdMonthlyIncome,
                Date__c: clientData.dateOfSubmission,
                Company: "Self",
                Status: "Closed - Converted",
                OwnerId: '005cn000006WqRS'
            },
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json',
                    'Sforce-Auto-Assign': 'FALSE'
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
 * Creates the Account
 * 
 * @param {*} accountData 
 * @param {*} leadId 
 * @param {*} salesforceAccessToken
 * @returns 
 */
async function createAccount(accountData, leadId, tokenData) {
    try {
        const instanceUrl = tokenData.instance_url

        const response = await axios.post(
            `${instanceUrl}/services/data/v61.0/sobjects/Account`,
            {
                Name: `${accountData.firstName} ${accountData.lastName} Household`,
                Primary_Language__c: accountData.primaryLanguage,
                Family_Type__c: accountData.familyType,
                Housing_Status__c: accountData.housingStatus,
                Address__Street__s: accountData.address.streetAddress,
                Address__City__s: accountData.address.city,
                Address__StateCode__s: accountData.address.stateCode,
                Address__CountryCode__s: "US",
                Address__PostalCode__s: accountData.address.zipcode,
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
 * Inserts all of the household members into Salesforce as a Contact and link it to their Account
 * 
 * @param {*} householdMembers
 * @param {*} leadId
 * @param {*} accountId
 * @param {*} salesforceAccessToken
 */
async function insertHouseholdMembers(householdMembers, leadId, accountId, tokenData) {
    console.log("Starting insertHouseholdMembers");
    const instanceUrl = tokenData.instance_url
    console.log("Instance URL: " + instanceUrl);

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
 * Retrieve the answer from the Fillout answers
 * 
 * @param {} questions 
 * @param {*} questionName 
 * @returns 
 */
function getAnswerForQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName);

    if (!questionObj) {
        throw new Error(`Question with name ${questionName} not found`);
    }

    return questionObj.value;
};

let cachedFilloutKey;

/**
 * 
 * @returns 
 */
async function getFilloutKey() {
    if (cachedFilloutKey) {
        return cachedFilloutKey;
    }

    const command = new GetSecretValueCommand({
        SecretId: "fillout-api"
    });

    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString);
    cachedFilloutKey = secret.token;
    return cachedFilloutKey;
}

/**
 * 
 * @param {*} documentUrl 
 * @param {*} filloutKey 
 * @returns 
 */
async function downloadIntake(documentUrl, filloutKey) {
    try {
        const response = await axios.get(documentUrl, {
            headers: {
                'Authorization': `Bearer ${filloutKey}`,
                'Accept': 'application/pdf'
            },
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error("Error downloading Fillout PDF:", {
            status: error.response?.status
        });
        throw error;
    }
}

/**
 * Uploads the intake pdf file to the Salesforce record
 * 
 * @param {*} base64Pdf 
 * @param {*} fileName 
 * @param {} recordId 
 * @param {*} tokenData 
 * @returns 
 */
async function uploadIntakeToSalesforceRecord(base64Pdf, fileName, recordId, tokenData) {
    const instanceUrl = tokenData.instance_url;

    const response = await axios.post(
        `${instanceUrl}/services/data/v61.0/sobjects/ContentVersion`,
        {
            Title: fileName,
            PathOnClient: fileName,
            VersionData: base64Pdf,
            FirstPublishLocationId: recordId
        },
        {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.id;
}

export const handler = async (event) => {
    console.log("Triggered");

    console.log("Raw event:", JSON.stringify(event));

    const body = JSON.parse(event.body);
    console.log("Parsed body:", JSON.stringify(body));

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
    const zipcode = address.zipCode;

    for (const key in address) {
        console.log(`API Name: ${key}, Value: ${address[key]}`)
    }

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

    await verifySalesforceSchema("Contact", tokenData);

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

    const accountId = await createAccount(accountData, leadId, tokenData);

    let intakeURL = body.submission.documents[0].url;

    const filloutKey = await getFilloutKey();
    const intakeBuffer = await downloadIntake(intakeURL, filloutKey)

    if (!intakeBuffer || intakeBuffer.length === 0) {
        throw new Error("Download PDF is empty");
    }

    const base64Pdf = intakeBuffer.toString("base64");
    await uploadIntakeToSalesforceRecord(base64Pdf, "BenePhilly Intake.pdf", leadId, tokenData);
    await uploadIntakeToSalesforceRecord(base64Pdf, "BenePhilly Intake.pdf", accountId, tokenData);

    await insertHouseholdMembers(householdMembers, leadId, accountId, tokenData);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Client Loaded to Salesforce Successfully!'),
    };
    return response;
}