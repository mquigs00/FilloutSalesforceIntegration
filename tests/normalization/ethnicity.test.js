import { normalizeEthnicity } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeEthnicity works in English", () => {
    assert.strictEqual(normalizeEthnicity("hispanic, latino, or spanish origins"), "Hispanic, Latino, or Spanish Origins");
});

test("Test normalizeEthnicity works in Spanish", () => {
    assert.strictEqual(normalizeEthnicity("orígenes hispanos, latinos o españoles"), "Hispanic, Latino, or Spanish Origins");
});