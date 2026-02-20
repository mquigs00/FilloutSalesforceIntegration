import {SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({region: "us-east-1"});

/**
 * Retrieves the Salesforce private key from Secrets Manager
 * 
 * @returns the Salesforce private key
 */
async function getPrivateKey() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: "arn:aws:secretsmanager:us-east-1:182486377871:secret:Salesforce-Sandbox-Private-Key-ZBweXe"
        });

        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error("Secret String for private key is empty or undefined");
        }

        console.log("Received response for Salesforce private key");

        return response.SecretString;
    } catch (error) {
        console.error("Error retrieving Salesforce private key");
        throw error;
    }
}

/**
 * Securely retreives the Salesforce consumer key, private key, username, and login url
 * 
 * @returns secrets - the JSON object with the four values
 */
export async function getSalesforceSecrets() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: "arn:aws:secretsmanager:us-east-1:182486377871:secret:SF-Sandbox-Credentials-OMWAfi"
        });
    
        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error("Secret String is empty or undefined");
        }

        const secrets = JSON.parse(response.SecretString);

        const privateKey = await getPrivateKey()

        return {
            consumerKey: secrets.consumerKey,
            privateKey: privateKey,
            username: secrets.username,
            loginUrl: secrets.loginUrl
        };
    } catch (error) {
        console.error("Error retreiving Salesforce credentials:", error);
        throw error;
    }
};

let cachedFilloutKey;

/**
 * Retrieves the Fillout API key from AWS Secrets Manager
 * 
 * @returns secret.token - the Fillout API key
 */
export async function getFilloutKey() {
    if (cachedFilloutKey) {
        return cachedFilloutKey;
    }

    const command = new GetSecretValueCommand({
        SecretId: "fillout-api"
    });

    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString);
    cachedFilloutKey = secret.token;
    return cachedFilloutKey;
}