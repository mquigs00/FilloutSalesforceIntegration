import { parseSubmission, downloadIntake } from '../utils/fillout.js';
import {getSalesforceAuthToken, duplicateLeadExists, createLead, createAccount, insertHouseholdMembers, uploadIntakeToSalesforceRecord} from '../salesforce/client.js';
import {getFilloutKey} from '../utils/secrets.js';

async function fetchIntakeAsBase64(intakeURL, filloutKey) {
    const intakeBuffer = await downloadIntake(intakeURL, filloutKey)

    if (!intakeBuffer || intakeBuffer.length === 0) {
        throw new Error("Download PDF is empty");
    }
    return intakeBuffer.toString("base64");
}

export async function processSubmission(body, dependencies) {
    const {householdMembers, leadData, accountData} = parseSubmission(body);

    const sfAuthToken = await dependencies.getToken();

    if (await dependencies.duplicateLeadExists(leadData, sfAuthToken)) {
        return {status: 'duplicate'};
    }

    const leadId = await dependencies.createLead(leadData, sfAuthToken);
    const accountId = await dependencies.createAccount(accountData, leadId, sfAuthToken);

    await dependencies.insertHouseholdMembers(householdMembers, accountId, sfAuthToken);

    return {
        status: 'success',
        leadId,
        accountId,
        sfAuthToken: sfAuthToken
    };
}


export async function processIntakeDocuments(body, leadId, accountId, sfAuthToken) {
    let intakeURL = body.submission.documents[0].url;
    if (!intakeURL) return;
    const filloutKey = await getFilloutKey();
    const base64Pdf = await fetchIntakeAsBase64(intakeURL, filloutKey);
    await uploadIntakeToSalesforceRecord(base64Pdf, "BenePhilly Intake.pdf", leadId, sfAuthToken);
    await uploadIntakeToSalesforceRecord(base64Pdf, "BenePhilly Intake.pdf", accountId, sfAuthToken);
}

export const handler = async (event) => {
    const body = JSON.parse(event.body);

    const result = await processSubmission(body, {
        getToken: getSalesforceAuthToken,
        duplicateLeadExists,
        createLead,
        createAccount,
        insertHouseholdMembers
    });

    if (result.status === 'success') {
        await processIntakeDocuments(body, result.leadId, result.accountId, result.salesforceAuthToken);
    }
    
    const response = {
        statusCode: 200,
        body: JSON.stringify(result.status),
    };

    return response;
}