import { normalizeEducation } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test('normalizeEducation maps English correctly', () => {
    assert.strictEqual(normalizeEducation("graduate or other post-secondary degree"), "Graduate or Other Post-Secondary Degree");
});

test('normalizeEducation maps Spanish correctly', () => {
    assert.strictEqual(normalizeEducation("otro título de educación superior"), "Graduate or Other Post-Secondary Degree");
});