import {processForm} from "./services/formProcessor.js";

export const handler = async (event) => {
    return await processForm(event);
};