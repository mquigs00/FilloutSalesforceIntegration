import {educationMap, maritalStatusMap, languageMap, ethnicityMap, raceMap, relationshipMap, healthInsuranceMap, genderMap, militaryStatusMap, housingStatusMap, familyTypeMap} from './formPicklistMaps.js';
import { sfEducationMap, sfEthnicityMap, sfGenderMap, sfHealthInsuranceMap, sfLanguageMap, sfMaritalStatusMap, sfMilitaryStatusMap, sfRaceMap, sfRelationshipMap, sfHousingStatusMap, sfFamilyTypeMap } from '../salesforce/picklistMaps.js';
import {reverseDictionary} from "../utils/utils.js";

const reverseMaps = {
    education: reverseDictionary(educationMap),
    maritalStatus: reverseDictionary(maritalStatusMap),
    language: reverseDictionary(languageMap),
    ethnicity: reverseDictionary(ethnicityMap),
    race: reverseDictionary(raceMap),
    relationship: reverseDictionary(relationshipMap),
    healthInsuranceMap: reverseDictionary(healthInsuranceMap),
    gender: reverseDictionary(genderMap),
    militaryStatus: reverseDictionary(militaryStatusMap),
    housingStatus: reverseDictionary(housingStatusMap),
    familyType: reverseDictionary(familyTypeMap)
}

const sfMaps = {
    education:sfEducationMap,
    maritalStatus: sfMaritalStatusMap,
    language: sfLanguageMap,
    ethnicity: sfEthnicityMap,
    race: sfRaceMap,
    relationship: sfRelationshipMap,
    healthInsuranceMap: sfHealthInsuranceMap,
    gender: sfGenderMap,
    militaryStatus: sfMilitaryStatusMap,
    housingStatus: sfHousingStatusMap,
    familyType: sfFamilyTypeMap
}

function normalizeWithMaps(value, field) {
    if (!value) return null;

    const cleanedEducation = value.trim().toLowerCase();

    const normalizedEducation = reverseMaps[field][cleanedEducation] ?? null;
    if (!normalizedEducation) return null;

    return sfMaps[field][normalizedEducation];
}

export const normalizeEducation = (value) =>
    normalizeWithMaps(value, "education");

export const normalizeMaritalStatus = (value) =>
    normalizeWithMaps(value, "maritalStatus");

export const normalizeLanguage = (value) =>
    normalizeWithMaps(value, "language");

export const normalizeEthnicity = (value) =>
    normalizeWithMaps(value, "ethnicity");

export const normalizeRace = (value) =>
    normalizeWithMaps(value, "race");

export const normalizeRelationship = (value) =>
    normalizeWithMaps(value, "relationship");

export const normalizeHealthInsurance = (value) =>
    normalizeWithMaps(value, "healthInsurance");

export const normalizeGender = (value) =>
    normalizeWithMaps(value, "gender");

export const normalizeMilitaryStatus = (value) =>
    normalizeWithMaps(value, "militaryStatus");

export const normalizeHousingStatus = (value) =>
    normalizeWithMaps(value, "housingStatus");

export const normalizeFamilyType = (value) =>
    normalizeWithMaps(value, "familyType");