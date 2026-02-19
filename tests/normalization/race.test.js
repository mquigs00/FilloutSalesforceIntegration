import {normalizeRace} from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeRace works in English", () => {
    assert.strictEqual(normalizeRace("black / african american"), "Black / African American");
});

test("Test normalizeRace works in Spanish", () => {
    assert.strictEqual(normalizeRace("negro / afroamericano"), "Black / African American");
});