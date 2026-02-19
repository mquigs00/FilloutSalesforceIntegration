import {normalizeHealthInsurance} from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeHealthInsurance works in English", () => {
    assert.strictEqual(normalizeHealthInsurance("employment based"), "Employment Based")
});

test("Test normalizeHealthInsurance works in Spanish", () => {
    assert.strictEqual(normalizeHealthInsurance("basado en el empleo"), "Employment Based")
});