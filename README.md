# FilloutSalesforceIntegration
## Impact:
This integation connects Fillout form submissions to the Salesforce BenePhilly User System (BUS) to automatically create Leads, Accounts, and Contacts when a potential client submits their Fillout intake form. This reduces the need for the counselors to perform manual data entry and maintains data integrity.

For each new household, counselors currently have to manually enter:
- A Lead (12 fields)
- A Screener (25-36 fields)
- A Contact (12 fields) for each family member

This integration can help automate the entry of:
- All 12 Lead Fields
- All 12 Contact fields per family member
- 18 of the Screener fields (when paired with a Salesforce flow)

| Scenario | # of Manually Entered Fields (w/o integration) | # of Manual Entered Fields (w/ integration) | Reduction % |
|----------|------------------------------------------------|----------------------------------------------|-------------|
| Household of 1 (homeless) | 49 | 7 | 86% |
| Household of 3 (renting) | 76 | 10 | 87% |
| Household of 6 (homeowner) | 115 | 13 | 89% |


Many agencies already use digital forms to collect clients' intake data. Rather than requiring counselors to read through client submissions and manually their answers into the BUS, this integration allows clients to send their data into the BUS without ever directly interacting with the BUS.

By having the Lead, Account, and Contacts created instantly when a client requests services, counselors can simply search for their Account at appointment time. Once found, the counselor can click "Check Eligibility" and a Salesforce Flow can pre-populate most of the Screeber fields using the data in the Account and Contacts. This allows counselors to quickly determine eligibility of their clients for public benefits programs and move on to filling out those applications.

## Pre-Requisites:
\* Every pre-requisite is free (or at least provides a limited free version), except for the AWS Secrets. This integration requires three secrets, which each cost ~$2.50 per month to store in AWS
1. Fillout
    - A Fillout account
    - A Fillout API key
2. Salesforce
    - System Administrator access with Setup permissions
    - An External Client App, private key, and certificate for OAuth JWT authentication
3. Amazon Web Services (AWS)
    - An AWS Account
    - Access to Secrets Manager, Lambda, and API Gateway (also ideally access to CloudWatch logs for debugging)

## Key Components:
1. Webhook Setup
    - A Fillout webhook is created and points to an AWS POST API endpoint
    - The webhook sends JSON payloads of form submissions to the endpoint
2. API Trigger
    - When the webhook fires, it triggers an AWS Lambda function containing the integration code
3. Form Processing
    - index.mjs calls formProcessor.js, which orchestrates the process
    - formProcessor.js first calls fillout.js to parse the form submission and group the fields required for each Salesforce record
4. Duplicate Check
    - formProcessor.js uses client.js functions to query the BUS for an existing Lead that meets the duplicate rule (matching First Name, Last Name, and Email Address)
    - If a matching Lead exists, the lambda handler stops and no new records are created
5. Record Creation
    - If there is no matching Lead, formProcessor.js creates:
        - A Lead
        - An Account
        - A Contact for each family member
6. PDF Upload
    - Finally, formProcessor.js uploads the pdf intake form (created and retrieved Fillout) to the Lead and the Account

## Security
- Authentication & Authorization: Integration uses JWT-based OAuth 2.0 to authenticate to Salesforce; no passwords are stored or transmitted; access is granted through certificate-base cryptographic verification
- Webhook Protection: All incoming webhook requests require a shared secret, validated by Lambda.
- Transport Security: All data is transmitted over HTTPS to protect PII and prevent tampering.
- Secrets Management: AWS Secrets Manager stores all sensitive credentials (private key, client ID, webhook secret), accessed only by the Lambda function using least-privilege
IAM roles.

## Secrets:
There are three secrets necessary\
When creating each secret, use "Other type of secret"
1. Salesforce External App Credentials
    - Type: Key/value
    - Pairs:
        - username: the username of a system administrator in your Salesforce org
        - loginUrl: the URL that you normally use to login to your Salesforce org
        - consumerKey: the consumer key of your External Client App
            - Can be found by navigating to Setup --> External Client App Manager --> Click on your app --> Settings --> OAuth Settings --> App Settings --> Consumer Key and Secret
2. Salesforce Private Key:
    - Type: Plaintext
    - Just paste in server.key text exactly as it appears in Notepad
3. Fillout API Key
    - Type: Key/value
    - Pairs:
        - fillout-api: paste the API key you created in Fillout
        - webhook-secret: paste the webhook secret you generated


## Troubleshooting / Common Errors
### OAuth Error: `invalid_grant`
```json
data:
    {
        error: 'invalid_grant',
        error_description: "user hasn't approved this consumer"
    }
```

**Cause:**
The External Client App's Permitted Users policy is set to "All users can self-authorize"

**Solution:**
1. Navigate to Setup --> External Client App Manager --> Click on your External Client App
2. Under OAuth Policies --> Plugin Policies --> Permitted Users
3. Make sure it is set to "Admin users are pre-approved"
4. Navigate to App Policies --> Select Profiles
5. Select System Administrator (make sure the username you put in the API credentials is set to System Administrator)

### OAuth Error: `External client app is not installed in this org`
```json
data:
    {
      error: 'app_not_found',
      error_description: 'External client app is not installed in this org'
    }
```
**Cause:**
The loginUrl provided in the Salesforce credentials secret is wrong

**Solution:**
Verify the loginURL is exactly the same URL you use to manually login

### Picklist Error `bad value for restricted picklist field`
```json
{
    message: 'Race: bad value for restricted picklist field: Native American / Alaskan Native',
    errorCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST',
    fields: [ 'Race__c' ]
}
```

**Cause**
One of the picklist values in the Fillout form does not match a picklist option for the corresponding Salesforce field

**Solution**
1. Go into Setup --> Object Manager --> The object that the field belongs to
2. On the left hand bar, click "Fields and Relationships"
3. Click on the field that the Fillout question pertains to
4. Verify that the picklist values at the bottom of the page exactly match the options in the Fillout picklist

### Picklist Error `No such column 'ColumnName' on sobject of type Object`
```json
{
    message: "No such column 'GenderIdentity' on sobject of type Contact",
    errorCode: 'INVALID_FIELD'
}
```

**Cause**
Trying to create a Salesforce object but using a field name that doesn't exist

**Solution**
1. Go into Setup --> Object Manager --> The object that the field belongs to
2. On the left hand bar, click "Fields and Relationships"
3. Verify that all fields listed in the axios API call match one of the values under "FIELD NAME"

## Limitations / Next Steps
Currently, this integration only supports form submissions in English. Fillout offers multilingual forms on their more expensive plan, but I have to not committed to upgrading plans. I am not sure how forms in Spanish or another language would change parsing the Submission.

## Example JSON Payload
```json
{
    "formId": "eLypJ5H8Hyus",
    "formName": "Salesforce Integration (English)",
    "submission": {
        "submissionId": "296958d1-1695-4d97-888f-9c80454e0fb4",
        "submissionTime": "2026-02-09T13:59:12.300Z",
        "lastUpdatedAt": "2026-02-09T13:59:12.300Z",
        "questions": [
            {
                "id": "hiTj",
                "name": "First Name",
                "type": "ShortAnswer",
                "value": "Bob"
            },
            {
                "id": "cdfp",
                "name": "Last Name",
                "type": "ShortAnswer",
                "value": "West"
            },
            {
                "id": "rfop",
                "name": "Email",
                "type": "EmailInput",
                "value": "mquigs00@gmail.com"
            },
        ]
    }
}
```

## References
- Fillout
    - [Create a Fillout API Key](https://www.fillout.com/help/fillout-rest-api)
    - [Create a Fillout Webhook](https://www.fillout.com/help/api-reference/create-a-webhook)
- Salesforce
    - [Create an External Client App](https://help.salesforce.com/s/articleView?id=xcloud.create_a_local_external_client_app.htm&type=5)
    - [Configure a JWT Bearer Flow](https://help.salesforce.com/s/articleView?id=xcloud.configure_oauth_jwt_flow_external_client_apps.htm&type=5)
- AWS
    - [Setup an HTTP POST API to Trigger a Lambda Function](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop.html)