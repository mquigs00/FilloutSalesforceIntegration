/**
 * Takes a dictionary of keys mapping to arrays of values and reverses it so every value in the array is now a key pointing to the original key
 * @param {Object} origDictionary 
 * @returns reverseDictionary
 */
export function reverseDictionary(origDictionary) {
    let reverseDictionary = {};

    for (const [canonical, variants] of Object.entries(origDictionary)) {
        for (const variant of variants) {
            reverseDictionary[variant] = canonical;
        }
    }

    return reverseDictionary;
}