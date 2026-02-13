import axios from 'axios';
import {getStateCode} from '../mappings/states.js';
import {getFilloutKey} from '../utils/secrets.js';

/**
 * Retrieve the answer from the Fillout answers
 * 
 * @param {Object[]} questions 
 * @param {str} questionName - the text that the user sees in Fillout (ex. "First Name")
 * @returns questionObj.val - the answer to the question
 */
function getAnswerForQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName);                                                  // find the question with the matching name

    if (!questionObj) {
        throw new Error(`Question with name ${questionName} not found`);
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
        firstName: getAnswerForQuestion(questions, "First Name"),
        lastName: getAnswerForQuestion(questions, "Last Name"),
        relationship: "Head of Household",
        phone: getAnswerForQuestion(questions, "Phone Number"),
        email: getAnswerForQuestion(questions, "Email"),
        birthdate: getAnswerForQuestion(questions, "Birthdate"),
        genderIdentity: getAnswerForQuestion(questions, "Gender Identity"),
        maritalStatus: getAnswerForQuestion(questions, "Marital Status"),
        race: getAnswerForQuestion(questions, "Race"),
        highestEducationCompleted: getAnswerForQuestion(questions, "Highest Education Completed"),
        militaryStatus: getAnswerForQuestion(questions, "Military Status"),
        ethnicity: getAnswerForQuestion(questions, "Ethnicity"),
        isDisabled: getAnswerForQuestion(questions, "Disabled?"),
        healthInsuranceCoverage: getAnswerForQuestion(questions, "Health Insurance Coverage")
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
    const householdSize = getAnswerForQuestion(questions, "Number of members in your household");

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
            firstName: getAnswerForQuestion(questions, "First Name"),
            lastName: getAnswerForQuestion(questions, "Last Name")
        },
        contact: {
            email: getAnswerForQuestion(questions, "Email"),
            phone: getAnswerForQuestion(questions, "Phone Number"),
            primaryLanguage: getAnswerForQuestion(questions, "Primary Language")
        },
        address: {
            streetAddress: address.streetAddress,
            city: address.streetAddress,
            state: address.state,
            stateCode: address.stateCode,
            zipcode: address.zipcode
        },
        household: {
            householdSize: getAnswerForQuestion(questions, "Number of members in your household"),
            householdMonthlyIncome: getAnswerForQuestion(questions, "Estimated Monthly Household Income")
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
        firstName: getAnswerForQuestion(questions, "First Name"),
        lastName: getAnswerForQuestion(questions, "Last Name"),
        primaryLanguage: getAnswerForQuestion(questions, "Primary Language"),
        housingStatus: getAnswerForQuestion(questions, "Housing Status"),
        familyType: getAnswerForQuestion(questions, "Family Type"),
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
    const address = getAnswerForQuestion(questions, "Your address");
    
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