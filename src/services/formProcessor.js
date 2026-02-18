import { parseSubmission, fetchIntakeAsBase64} from '../utils/fillout.js';
import {getSalesforceAuthToken, duplicateLeadExists, createLead, createAccount, createContact, uploadIntakeToSalesforceRecord} from '../salesforce/client.js';

async function insertHouseholdMembers(householdMembers, accountId, sfAuthToken) {
    for (let i = 0; i < householdMembers.length; i++) {
        createContact(householdMembers[i], accountId, sfAuthToken);
    }
}

async function processSubmission(body, dependencies) {
    const {householdMembers, leadData, accountData} = parseSubmission(body);

    const sfAuthToken = await dependencies.getToken();

    if (await dependencies.duplicateLeadExists(leadData, sfAuthToken)) {
        return {status: 'duplicate'};
    }

    const leadId = await dependencies.createLead(leadData, sfAuthToken);
    const accountId = await dependencies.createAccount(accountData, sfAuthToken);

    await insertHouseholdMembers(householdMembers, accountId, sfAuthToken);

    return {
        status: 'success',
        leadId,
        accountId,
        sfAuthToken: sfAuthToken
    };
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