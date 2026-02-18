import { normalizeEducation } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test('normalizeEducation maps English correctly', () => {
    assert.strictEqual(normalizeEducation("Graduate or Other Post-Secondary Degree"), "Graduate or Other Post-Secondary Degree");
});

test('normalizeEducation maps Spanish correctly', () => {
    assert.strictEqual(normalizeEducation("Otro título de educación superior"), "Graduate or Other Post-Secondary Degree");
});