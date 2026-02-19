import { normalizeFamilyType } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeFamilyType works in English", () => {
    assert.strictEqual(normalizeFamilyType("single person"), "Single Person");
})

test("Test normalizeFamilyType works in Spanish", () => {
    assert.strictEqual(normalizeFamilyType("persona soltera"), "Single Person");
});