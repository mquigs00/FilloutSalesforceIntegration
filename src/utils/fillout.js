import axios from 'axios';
import {getStateCode} from '../mappings/states.js';
import {getFilloutKey} from '../utils/secrets.js';
import { fieldMap, otherMembersFieldMap } from '../mappings/fieldMap.js';

/**
 * Retrieve the answer from the Fillout answers
 * 
 * @param {Object[]} questions 
 * @param {str} questionId - the unique four letter id for the question
 * @returns questionObj.val - the answer to the question
 */
function getAnswerForQuestion(questions, questionId) {
    const questionObj = questions.find(question => question.id === questionId);                                                  // find the question with the matching name

    if (!questionObj) {
        throw new Error(`Question with name ${questionId} not found`);
    }

    return questionObj.value;                                                                                                           // value is the answer to the question
};

/**
 * Downloads the intake pdf document from Fillout
 * 
 * @param {str} documentUrl 
 * @param {str} filloutKey 
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

export async function fetchIntakeAsBase64(intakeURL) {
    const filloutKey = await getFilloutKey();
    const intakeBuffer = await downloadIntake(intakeURL, filloutKey)

    if (!intakeBuffer || intakeBuffer.length === 0) {
        throw new Error("Download PDF is empty");
    }
    return intakeBuffer.toString("base64");
}

/**
 * Parses the head of household's data
 * 
 * @param {Object[]} questions 
 * @returns Object
 */
function parseHeadOfHousehold(questions) {
    return {
        firstName: getAnswerForQuestion(questions, fieldMap.firstName),
        lastName: getAnswerForQuestion(questions, fieldMap.lastName),
        relationship: "Head of Household",
        phone: getAnswerForQuestion(questions, fieldMap.phoneNumber),
        email: getAnswerForQuestion(questions, fieldMap.email),
        birthdate: getAnswerForQuestion(questions, fieldMap.birthdate),
        genderIdentity: getAnswerForQuestion(questions, fieldMap.genderIdentity),
        maritalStatus: getAnswerForQuestion(questions, fieldMap.maritalStatus),
        race: getAnswerForQuestion(questions, fieldMap.race),
        highestEducationCompleted: getAnswerForQuestion(questions, fieldMap.highestEducationCompleted),
        militaryStatus: getAnswerForQuestion(questions, fieldMap.militaryStatus),
        ethnicity: getAnswerForQuestion(questions, fieldMap.ethnicity),
        isDisabled: getAnswerForQuestion(questions, fieldMap.isDisabled),
        healthInsuranceCoverage: getAnswerForQuestion(questions, fieldMap.healthInsuraceCoverage)
    }
}

/**
 * Parses any household members other than the head of household
 * 
 * @param {Object[]} questions 
 * @param {int} householdSize - the number of household members
 * @returns {Object[]} otherHouseholdMembers
 */
function parseOtherHouseholdMembers(questions, householdSize) {
    let otherHouseholdMembers = [];

    for (let i = 2; i <= householdSize; i++) {
        memberFields = otherMembersFieldMap[i];

        let nextMember = {}
        nextMember.firstName = getAnswerForQuestion(questions, memberFields.firstName);
        nextMember.lastName = getAnswerForQuestion(questions, memberFields.lastName);
        nextMember.birthdate = getAnswerForQuestion(questions, memberFields.birthdate);
        nextMember.relationship = getAnswerForQuestion(questions, memberFields.relationship);
        nextMember.genderIdentity = getAnswerForQuestion(questions, memberFields.genderIdentity);
        nextMember.maritalStatus = getAnswerForQuestion(questions, memberFields.maritalStatus);
        nextMember.race = getAnswerForQuestion(questions, memberFields.race);
        nextMember.highestEducationCompleted = getAnswerForQuestion(questions, memberFields.highestEducationCompleted);
        nextMember.militaryStatus = getAnswerForQuestion(questions, memberFields.militaryStatus);
        nextMember.ethnicity = getAnswerForQuestion(questions, memberFields.ethnicity);
        nextMember.isDisabled = getAnswerForQuestion(questions, memberFields.isDisabled);
        nextMember.healthInsuranceCoverage = getAnswerForQuestion(questions, memberFields.healthInsuranceCoverage);
        otherHouseholdMembers.push(nextMember);
    }

    return otherHouseholdMembers;
}

/**
 * Parses the houeshold members and returns their objects in a list
 * @param {Object[]} questions 
 * @returns {Object[]}
 */
function parseHouseholdMembers(questions) {
    const householdSize = getAnswerForQuestion(questions, fieldMap.householdSize);

    const headOfHousehold = parseHeadOfHousehold(questions);
    const otherHouseholdMembers = parseOtherHouseholdMembers(questions, householdSize);
    
    return [headOfHousehold, ...otherHouseholdMembers];
}

/**
 * Extracts and groups the data needed for the Lead
 * 
 * @param {Object[]} questions 
 * @param {Object} address 
 * @returns 
 */
function buildLeadData(questions, address) {
    const leadData = {
        personal: {
            firstName: getAnswerForQuestion(questions, fieldMap.firstName),
            lastName: getAnswerForQuestion(questions, fieldMap.lastName)
        },
        contact: {
            email: getAnswerForQuestion(questions, fieldMap.email),
            phone: getAnswerForQuestion(questions, fieldMap.phoneNumber),
            primaryLanguage: getAnswerForQuestion(questions, fieldMap.primaryLanguage)
        },
        address: {
            streetAddress: address.streetAddress,
            city: address.city,
            state: address.state,
            stateCode: address.stateCode,
            zipcode: address.zipcode
        },
        household: {
            householdSize: getAnswerForQuestion(questions, fieldMap.householdSize),
            householdMonthlyIncome: getAnswerForQuestion(questions, fieldMap.monthlyHouseholdIncome)
        },
        dateOfSubmission: getAnswerForQuestion(questions, "Date")
    };

    return leadData;
}

/**
 * Extracts amd groups the data needed for the Account
 * 
 * @param {Object[]} questions 
 * @param {Object} address 
 * @returns 
 */
function buildAccountData(questions, address) {
    const accountData = {
        firstName: getAnswerForQuestion(questions, fieldMap.firstName),
        lastName: getAnswerForQuestion(questions, fieldMap.lastName),
        primaryLanguage: getAnswerForQuestion(questions, fieldMap.primaryLanguage),
        housingStatus: getAnswerForQuestion(questions, fieldMap.housingStatus),
        familyType: getAnswerForQuestion(questions, fieldMap.familyType),
        address: {
            streetAddress: address.streetAddress,
            city: address.city,
            state: address.state,
            stateCode: address.stateCode,
            zipcode: address.zipCode
        }
    };

    return accountData;
}

/**
 * Finds the address object and extracts the street address, city, state, and zipcode
 * 
 * @param {Object[]} questions 
 * @returns {Object} the address components
 */
function parseAddress(questions) {
    const address = getAnswerForQuestion(questions, fieldMap.address);
    
    return {
        streetAddress: address.address,
        city: address.city,
        state: address.state,
        stateCode: getStateCode(address.state),
        zipcode: address.zipCode
    }
}

/**
 * Extracts the list of household members, the Lead data, and the Account data
 * 
 * @param {Object} eventBody - the parsed JSON body of the Fillout webhook
 * @returns {Object} householdMembers{List}, leadData{Object}, accountData{Object}
 */
export function parseSubmission(eventBody) {
    let questions = eventBody.submission.questions;

    const householdMembers = parseHouseholdMembers(questions);
    const address = parseAddress(questions);
    const leadData = buildLeadData(questions, address);
    const accountData = buildAccountData(questions, address);

    return {householdMembers, leadData, accountData};
}