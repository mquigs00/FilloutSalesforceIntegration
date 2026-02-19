import {normalizeMaritalStatus} from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeMaritalStatus works in English", () => {
    assert.strictEqual(normalizeMaritalStatus("married, living together"), "Married, Living Together");
});

test("Test normalizeMaritalStatus works in Spanish", () => {
    assert.strictEqual(normalizeMaritalStatus("married, living together"), "Married, Living Together");
});