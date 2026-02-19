import { normalizeLanguage, normalizeHousingStatus, normalizeFamilyType, normalizeEducation, normalizeEthnicity, normalizeGender, normalizeHealthInsurance, normalizeMaritalStatus, normalizeRace, normalizeRelationship, normalizeMilitaryStatus} from "../normalization/normalize.js";

export function buildAccountPayload(accountData) {
    return {
        Name: `${accountData.firstName} ${accountData.lastName} Household`,
        Primary_Language__c: normalizeLanguage(accountData.primaryLanguage),
        Family_Type__c: normalizeFamilyType(accountData.familyType),
        Housing_Status__c: normalizeHousingStatus(accountData.housingStatus),
        Address__Street__s: accountData.address.streetAddress,
        Address__City__s: accountData.address.city,
        Address__StateCode__s: accountData.address.stateCode,
        Address__CountryCode__s: "US",
        Address__PostalCode__s: accountData.address.zipCode,
    }
}

export function buildContactPayload(householdMember, accountId) {
    const disabledMap = {
        "Yes": true,
        "No": false
    }

    return {
        FirstName: householdMember.firstName,
        LastName: householdMember.lastName,
        Relationship_to_Head_of_Household__c: normalizeRelationship(householdMember.relationship),
        Birthdate: householdMember.birthdate,
        Gender_Identity__c: normalizeGender(householdMember.genderIdentity),
        Race__c: normalizeRace(householdMember.race),
        Hispanic_Status__c: normalizeEthnicity(householdMember.ethnicity),
        Highest_Education_Completed__c: normalizeEducation(householdMember.highestEducationCompleted),
        Marital_Status__c: normalizeMaritalStatus(householdMember.maritalStatus),
        Military_Status__c: normalizeMilitaryStatus(householdMember.militaryStatus),
        Health_Insurance_Coverage__c: normalizeHealthInsurance(householdMember.healthInsuranceCoverage),
        Disabled__c: disabledMap[householdMember.isDisabled],
        AccountId: accountId,
    }
}

export function buildLeadPayload(leadData) {
    return {
        FirstName: leadData.personal.firstName,
        LastName: leadData.personal.lastName,
        Street: leadData.address.streetAddress,
        City: leadData.address.city,
        PostalCode: leadData.address.zipcode,
        Country: "US",
        State: leadData.address.state,
        Phone: leadData.contact.phone,
        Email: leadData.contact.email,
        Primary_Language__c: normalizeLanguage(leadData.contact.primaryLanguage),
        Household_Size__c: leadData.household.householdSize,
        Estimated_Monthly_Household_Income__c: leadData.household.householdMonthlyIncome,
        Date__c: leadData.dateOfSubmission,
        Company: "Self",
        Status: "Closed - Converted",
        OwnerId: '005cn000006WqRS'
    }
}