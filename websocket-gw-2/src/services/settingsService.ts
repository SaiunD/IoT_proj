import { settingsTable } from "../constants/tableNames";
import { dynamodbClient, GetItemCommand, PutItemCommand } from "../utils/dynamoClient";
import { hashPassword } from "../utils/cryptoUtils";

export async function isPasswordValid(inputPassword: string): Promise<boolean> {
    const getCommand = new GetItemCommand({
        TableName: settingsTable,
        Key: {
            settingName: { S: "adminPassword" }, // ✅ без marshall
        },
    });

    const result = await dynamodbClient.send(getCommand);

    if (!result.Item) {
        const hashed = hashPassword("1234");

        const putCommand = new PutItemCommand({
            TableName: settingsTable,
            Item: {
                settingName: { S: "adminPassword" },
                value: { S: hashed },
            },
        });

        await dynamodbClient.send(putCommand);
        return true;
    }

    const storedHash = result.Item.value.S;
    return storedHash === hashPassword(inputPassword);
}


export const getPhone = async () => {
    try {
        const getCommand = new GetItemCommand({
            TableName: settingsTable,
            Key: {
                settingName: { S: "phone" },
            },
        });

        const result = await dynamodbClient.send(getCommand);

        if (!result.Item) {
            // Ініціалізуємо без валідації
            const putCommand = new PutItemCommand({
                TableName: settingsTable,
                Item: {
                    settingName: { S: "phone" },
                    value: { S: "" },
                    updatedAt: { N: Date.now().toString() },
                },
            });
            await dynamodbClient.send(putCommand);

            return { phone: "", updatedAt: Date.now() };
        }

        return {
            phone: result.Item.value.S || "",
            updatedAt: parseInt(result.Item.updatedAt?.N || "0", 10),
        };
    } catch (err) {
        console.error("Error getting phone:", JSON.stringify(err, null, 2));
        throw new Error("Failed to retrieve phone number");
    }
};

export const updatePhone = async (phone: string) => {
    if (typeof phone !== "string" || phone.length <= 5) {
        throw new Error("Invalid phone number format");
    }

    try {
        const putCommand = new PutItemCommand({
            TableName: settingsTable,
            Item: {
                settingName: { S: "phone" },
                value: { S: phone },
                updatedAt: { N: Date.now().toString() },
            },
        });
        await dynamodbClient.send(putCommand);
    } catch (err) {
        console.error("Error updating phone:", err);
        throw new Error("Failed to update phone number");
    }
};