import jwt from "jsonwebtoken";
import axios from 'axios';
import { getSalesforceSecrets } from "../utils/secrets.js";
import { buildLeadPayload, buildContactPayload, buildAccountPayload } from "./buildPayloads.js";

/**
 * Logs the name and label of each field for the given Object
 * 
 * @param {string} objectName - the name of the Salesforce Object (Lead, Account, Contact)
 * @param {string} sfAuthToken
 * @returns
 */
async function verifySalesforceSchema(objectName, sfAuthToken) {
    try {
        const instanceUrl = sfAuthToken.instance_url

        const response = await axios.get(
            `${instanceUrl}/services/data/v61.0/sobjects/${objectName}/describe`,
            {
                headers: {
                    'Authorization': `Bearer ${sfAuthToken.access_token}`,
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
 * Makes an API call to Salesforce to get a temporary auth token
 * 
 * @returns {Object} res.data - JSON object containing
 *      - access_token: string
 *      - instance_url: string
 *      - id: string
 *      - token_type: string
 */
export async function getSalesforceAuthToken() {
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
            exp: Math.floor(Date.now() / 1000) + (3 * 60)                                                                       // the access token will expire after 3 minutes
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

        return res.data;
    } catch (error) {
        console.error("Error retreiving Salesforce access token:", error);
        throw error;
    }
};

/**
 * Checks if a matching Lead already exists in Salesforce account with the same first name, last name, and email address
 * 
 * @param {Object} leadData 
 * @param {JWT Object} salesforceAccessToken
 * @returns duplicateLeadExists - boolean indicating whether a duplicate lead exists
 */
export async function duplicateLeadExists(leadData, sfAuthToken) {
    try {
        const instanceUrl = sfAuthToken.instance_url

        // query to check for Leads with the same first name, last name, and email address
        const selectDuplicateQuery = `
            SELECT FirstName, LastName, Email
            FROM Lead
            WHERE FirstName = '${leadData.personal.firstName}'
            AND LastName = '${leadData.personal.lastName}'
            AND Email = '${leadData.contact.email}'
        `;

        const response = await axios.get(
            `${instanceUrl}/services/data/v61.0/query/?q=${encodeURIComponent(selectDuplicateQuery)}`,
            {
                headers: {
                    'Authorization': `Bearer ${sfAuthToken.access_token}`
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
 * Creates the Lead in Salesforce
 * 
 * @param {json} leadData
 * @param {*} sfAuthToken
 * 
 * @returns the id of the new Lead record
 */
export async function createLead(leadData, sfAuthToken) {
    try {
        const instanceUrl = sfAuthToken.instance_url
        const leadPayload = buildLeadPayload(leadData);
        const response = await axios.post(
            `${instanceUrl}/services/data/v61.0/sobjects/Lead`,
            leadPayload,
            {
                headers: {
                    'Authorization': `Bearer ${sfAuthToken.access_token}`,
                    'Content-Type': 'application/json',
                    'Sforce-Auto-Assign': 'FALSE'
                }
            }
        );

        const leadId = response.data.id;
        return leadId;
    } catch (error) {
        console.error("Error inserting lead:", error.response.data);
        throw error;
    };
};

/**
 * Creates the Account
 * 
 * @param {Object} accountData 
 * @param {*} sfAuthToken
 * @returns accountId - the ID of the newly created Account
 */
export async function createAccount(accountData, sfAuthToken) {
    try {
        const instanceUrl = sfAuthToken.instance_url

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
                Address__PostalCode__s: accountData.address.zipCode,
            },
            {
                headers: {
                    'Authorization': `Bearer ${sfAuthToken.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accountId = response.data.id;

        return accountId;
    } catch (error) {
        console.error("Error creating Account: ", error.response.data || error.message);
        throw error;
    }
}

/**
 * Creates a Contact in Salesforce
 * 
 * @param {Object} - an object will all the necessary info about the Contact, except for which Account/Household they belong to
 * @param {int} accountId
 * @param {*} sfAuthToken
 * @returns {int} contactId - the ID of the newly created Contact
 */
export async function createContact(contactData, accountId, sfAuthToken) {
    const instanceUrl = sfAuthToken.instance_url;
    try {
        const contactPayload = buildContactPayload(contactData, accountId);

        const response = await axios.post(
            `${instanceUrl}/services/data/v61.0/sobjects/Contact`,
            contactPayload,
            {
                headers: {
                    'Authorization': `Bearer ${sfAuthToken.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        const contactId = response.data.id;
        return contactId;
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
 * Uploads the intake pdf file to the Salesforce record
 * 
 * @param {*} base64Pdf 
 * @param {*} fileName 
 * @param {} recordId 
 * @param {*} sfAuthToken
 * @returns 
 */
export async function uploadIntakeToSalesforceRecord(base64Pdf, fileName, recordId, sfAuthToken) {
    const instanceUrl = sfAuthToken.instance_url;

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
                'Authorization': `Bearer ${sfAuthToken.access_token}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.id;
}