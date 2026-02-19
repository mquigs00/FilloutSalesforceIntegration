import {normalizeRelationship} from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeRelationship works in English", () => {
    assert.strictEqual(normalizeRelationship("spouse"), "Spouse");
});

test("Test normalizeRelationship works in Spanish", () => {
    assert.strictEqual(normalizeRelationship("cónyuge"), "Spouse");
});