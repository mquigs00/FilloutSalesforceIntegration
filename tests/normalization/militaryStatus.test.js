import { normalizeMilitaryStatus } from "../../src/normalization/normalize.js";
import test from "node:test";
import assert from "node:assert";

test("Test normalizeMilitaryStatus works in English", () => {
    assert.strictEqual(normalizeMilitaryStatus("active military"), "Active Military");
});

test("Test normalizeMilitaryStatus works in Spanish", () => {
    assert.strictEqual(normalizeMilitaryStatus("active military"), "Active Military");
});