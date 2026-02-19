import { normalizeGender } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeGender works in English", () => {
    assert.strictEqual(normalizeGender("man"), "Man")
});

test("Test normalizeGender works in Spanish", () => {
    assert.strictEqual(normalizeGender("hombre"), "Man")
});