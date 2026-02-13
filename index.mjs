import {processForm} from "./src/services/formProcessor.js";

export const handler = async (event) => {
    return await processForm(event);
};