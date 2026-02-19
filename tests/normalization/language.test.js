import { normalizeLanguage } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeLanguage works in English", () => {
    assert.strictEqual(normalizeLanguage("english"), "English");
});

test("Test normalizeLanguage works in Spanish", () => {
    assert.strictEqual(normalizeLanguage("inglés"), "English");
});