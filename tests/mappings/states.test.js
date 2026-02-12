import { getStateCode } from '../../src/mappings/states.js';
import test from 'node:test';
import assert from 'node:assert';

test('maps Pennsylvania to PA', () => {
    assert.strictEqual(getStateCode('Pennsylvania'), 'PA');
});

test('throws error for string thats not a state', () => {
    assert.throws(() => {
        getStateCode('Philadelphia');
    });
});

test('throws error for null input', () => {
    assert.throws(() => {
        getStateCode(null);
    });
});