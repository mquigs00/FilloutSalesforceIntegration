import { normalizeEthnicity } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeEthnicity works", () => {
    assert.strictEqual(normalizeEthnicity("Hispanic, Latino, or Spanish Origins"), "Hispanic, Latino, or Spanish Origins");
});