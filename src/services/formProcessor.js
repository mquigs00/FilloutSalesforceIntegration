import { parseSubmission, fetchIntakeAsBase64} from '../utils/fillout.js';
import {getSalesforceAuthToken, duplicateLeadExists, createLead, createAccount, createContact, uploadIntakeToSalesforceRecord} from '../salesforce/client.js';
import { leadSchema, accountSchema, contactSchema, documentSchema } from '../validation/schemas.js';

/**
 * Creates each household member as a Contact in the Account
 * 
 * @param {Array[Object]} householdMembers - a list of each household member object
 * @param {*} accountId - the ID of the Account that each household member should be linked to
 * @param {*} sfAuthToken - the Salesforce Auth Token required to call their API
 */
async function insertHouseholdMembers(householdMembers, accountId, sfAuthToken) {
    for (let i = 0; i < householdMembers.length; i++) {
        const contactValidation = contactSchema.safeParse(householdMembers[i]);

        if (!contactValidation.success) {
            console.warn(`Invalid Contact for family member ${i+1}:`, contactValidation.error.errors);
            continue;
        }
        
        await createContact(householdMembers[i], accountId, sfAuthToken);
    }
}

async function processIntakeDocuments(body, leadId, accountId, sfAuthToken) {
    let intakeURL = body.submission.documents[0].url;

    if (!intakeURL) {
        console.log("No intake document url found, can't upload intake pdf's!");
    }
    
    const base64Pdf = await fetchIntakeAsBase64(intakeURL);
    
    await uploadIntakeToSalesforceRecord(base64Pdf, "BenePhilly Intake.pdf", leadId, sfAuthToken);
    await uploadIntakeToSalesforceRecord(base64Pdf, "BenePhilly Intake.pdf", accountId, sfAuthToken);
}


/**
 * Ochestrates the processing of a Fillout submission and the creation of Salesforce records (if no existing record matches)
 * 
 * @param {Object} body - Raw Fillout webhook payload
 * @param {Object} dependencies
 * @param {Function} dependencies.getToken: Retreives a Salesforce Access Token required for calling the Salesforce API
 * @param {Function} dependencies.duplicateLeadExists: Checks if there is already a Lead in the system with matching key values
 * @param {Function} dependencies.createLead
 * @param {Function} dependencies.createAccount
 * @returns {Promise<{
 *      status: 'success' | 'duplicate',
 *      leadId?: string,
 *      accountId?: string,
 *      sfAuthToken?: Object
 * }>}
 */
async function processSubmission(body, dependencies) {
    const {householdMembers, leadData, accountData} = parseSubmission(body);

    const sfAuthToken = await dependencies.getToken();

    if (await dependencies.duplicateLeadExists(leadData, sfAuthToken)) {
        return {status: 'duplicate'};
    }

    const leadValidation = leadSchema.safeParse(leadData);
    
    if (!leadValidation.success) {
        console.error("Invalid Lead data: ", leadValidation.error.errors);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Lead validation failed", errors: leadValidation.error.errors}),
        };
    }

    const leadId = await dependencies.createLead(leadData, sfAuthToken);

    const accountValidation = accountSchema.safeParse(accountData);

    if (!accountValidation.success) {
        console.error("Invalid Account data: ", accountValidation.error.errors);
        return {
            statusCode: 400,
            body: JSON.stringify({message: "Account validation failed", errors: accountValidation.error.errors}),
        };
    }

    const accountId = await dependencies.createAccount(accountData, sfAuthToken);

    await insertHouseholdMembers(householdMembers, accountId, sfAuthToken);

    return {
        status: 'success',
        leadId,
        accountId,
        sfAuthToken: sfAuthToken
    };
}

/**
 * Orchestrates the processing of the Fillout form submission from end to end
 * 
 * @param {Object} event 
 * @returns response
 */
export const processForm = async (event) => {
    const body = JSON.parse(event.body);

    const result = await processSubmission(body, {
        getToken: getSalesforceAuthToken,
        duplicateLeadExists,
        createLead,
        createAccount
    });

    if (result.status === 'success') {
        await processIntakeDocuments(body, result.leadId, result.accountId, result.sfAuthToken);
    }
    
    const response = {
        statusCode: 200,
        body: JSON.stringify(result.status),
    };

    return response;
}