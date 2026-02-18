import {educationMap, maritalStatusMap, languageMap, ethnicityMap, raceMap, relationshipMap, healthInsuranceMap, genderMap} from '../normalization/index.js';
import { sfEducationMap, sfEthnicityMap, sfGenderMap, sfHealthInsuranceMap, sfLanguageMap, sfMaritalStatusMap, sfRaceMap, sfRelationshipMap } from '../salesforce/picklistMaps.js';

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

export const normalizeHealthInsuranc = (value) =>
    normalizeWithMaps(value, healthInsuranceMap, sfHealthInsuranceMap);

export const normalizeGender = (value) =>
    normalizeWithMaps(value, genderMap, sfGenderMap);