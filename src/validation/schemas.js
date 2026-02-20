import {z} from "zod";

export const leadSchema = z.object({
    personal: z.object({
        firstName: z.string().optional(),
        lastName: z.string().min(1),
    }),
    contact: z.object({
        email: z.email().optional(),
        phone: z.string().optional(),
        primaryLanguage: z.string
    }),
    address: z.object({
        streetAddress: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().length(2).optionall(),
        zipCode: z.string().length(5).optional()
    }),
    household: z.object({
        householdSize: z.int().optional(),
        householdMonthlyIncome: z.int().optional()
    }),
    dateOfSubmission: z.date().optional()
});

export const accountSchema = z.object({
    fistName: z.string().optional(),
    lastName: z.string().min(1),
    primaryLanguage: z.string().optional(),
    housingStatus: z.string().optional(),
    familyType: z.string().optional(),
    address: z.object({
        streetAddress: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().length(2).optional(),
        zipCode: z.string().optional()
    })
});

export const contactSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().min(1),
    birthdate: z.date.optional(),
    relationship: z.string().optional(),
    genderIdentity: z.string().optional(),
    maritalStatus: z.string.optional(),
    race: z.string().optional(),
    highestEducationCompleted: z.string().optional(),
    militaryStatus: z.string.optional(),
    ethnicity: z.string().optional(),
    isDisabled: z.string.optional(),
    healthInsuranceCoverage: z.string().optional()
});

export const documentSchema = z.object({
    base64Pdf: z.string().min(1),
    fileName: z.string().min(1),
    recordId: z.string().min(15)
})