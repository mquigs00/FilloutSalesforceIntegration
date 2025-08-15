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

        console.log("Received response for Salesforce private key");

        return response.SecretString;
    } catch (error) {
        console.error("Error retrieving Salesforce private key");
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

        console.log("Received response for Salesforce credentials");
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

        console.log("Login URL: " + loginUrl + " Username = " + username);

        const jwtQuery = {
            iss: consumerKey,
            sub: username,
            aud: loginUrl,
            exp: Math.floor(Date.now() / 1000) + (3 * 60)                               // the token will expire after 3 minutes
        };

        const signedJWT = jwt.sign(jwtQuery, reformattedPrivateKey, {algorithm: 'RS256'});

        console.log(signedJWT);

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

async function insertLead(clientData, tokenData) {
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
            Primary_Language__c: clientData.contact.primaryLanuage,
            Household_Size__c: clientData.household.householdSize,
            Estimated_Monthly_Household_Income__c: clientData.household.householdMonthlyIncome,
            Company: "Self",
            Status: "Open - Not Contacted"
        },
        {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        }
    )
};

function getAnswerForQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName);

    if (!questionObj) {
        throw new Error(`Question with name ${questionName} not found`);
    }

    return questionObj.value;
};

export const handler = async (event) => {
    console.log("Triggered");

    const body = JSON.parse(event.body);
    let questions = body.submission.questions;

    const firstName = getAnswerForQuestion(questions, "First Name");
    const lastName = getAnswerForQuestion(questions, "Last Name");
    const email = getAnswerForQuestion(questions, "Email");
    const phone = getAnswerForQuestion(questions, "Phone");
    const address = getAnswerForQuestion(questions, "Your address");
    const primaryLanuage = getAnswerForQuestion(questions, "Primary Language");
    const householdSize = getAnswerForQuestion(questions, "Number of family members in your household");
    const householdMonthlyIncome = getAnswerForQuestion(questions, "Estimated Monthly Household Income");

    const streetAddress = address.address;
    const city = address.city;
    const state = address.state;
    const stateCode = getStateCode(state);
    const zipcode = address.zipcode;

    console.log("Extracted all form data");

    const clientData = {
        personal: {
            firstName,
            lastName
        },
        contact: {
            email,
            phone,
            primaryLanuage
        },
        address: {
            streetAddress,
            city,
            state,
            stateCode,
            zipcode
        },
        household: {
            householdSize,
            householdMonthlyIncome
        }
    };

    const tokenData = await getSalesforceAccessToken();

    console.log("Retrieved signed JWT token")

    await insertLead(clientData, tokenData);

    console.log("Passed insert lead");

    const response = {
        statusCode: 200,
        body: JSON.stringify('Client Loaded to Salesforce Successfully!'),
    };
    return response;
}