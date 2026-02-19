import {normalizeHousingStatus} from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeHousingStatus in English", () => {
    assert.strictEqual(normalizeHousingStatus("rent"), "Rent");
});

test("Test normalizeHousingStatus in Spanish", () => {
    assert.strictEqual(normalizeHousingStatus("alquilar"), "Rent");
});