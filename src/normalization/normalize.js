import {educationMap, maritalStatusMap, languageMap, ethnicityMap, raceMap, relationshipMap, healthInsuranceMap, genderMap, militaryStatusMap, housingStatusMap, familyTypeMap} from '../normalization/index.js';
import { sfEducationMap, sfEthnicityMap, sfGenderMap, sfHealthInsuranceMap, sfLanguageMap, sfMaritalStatusMap, sfMilitaryStatusMap, sfRaceMap, sfRelationshipMap, sfHousingStatusMap, sfFamilyTypeMap } from '../salesforce/picklistMaps.js';

function normalizeWithMaps(value, filloutMap, sfMap) {
    if (!value) return null;

    const cleanedEducation = value.trim();

    const normalizedEducation = filloutMap[cleanedEducation] ?? null;
    if (!normalizedEducation) return null;

    return sfMap[normalizedEducation];
}

export const normalizeEducation = (value) =>
    normalizeWithMaps(value, educationMap, sfEducationMap);

export const normalizeMaritalStatus = (value) =>
    normalizeWithMaps(value, maritalStatusMap, sfMaritalStatusMap);

export const normalizeLanguage = (value) =>
    normalizeWithMaps(value, languageMap, sfLanguageMap);

export const normalizeEthnicity = (value) =>
    normalizeWithMaps(value, ethnicityMap, sfEthnicityMap);

export const normalizeRace = (value) =>
    normalizeWithMaps(value, raceMap, sfRaceMap);

export const normalizeRelationship = (value) =>
    normalizeWithMaps(value, relationshipMap, sfRelationshipMap);

export const normalizeHealthInsurance = (value) =>
    normalizeWithMaps(value, healthInsuranceMap, sfHealthInsuranceMap);

export const normalizeGender = (value) =>
    normalizeWithMaps(value, genderMap, sfGenderMap);

export const normalizeMilitaryStatus = (value) =>
    normalizeWithMaps(value, militaryStatusMap, sfMilitaryStatusMap);

export const normalizeHousingStatus = (value) =>
    normalizeWithMaps(value, housingStatusMap, sfHousingStatusMap);

export const normalizeFamilyType = (value) =>
    normalizeWithMaps(value, familyTypeMap, sfFamilyTypeMap);