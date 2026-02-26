import { sendMessage } from "../utils/wsUtils";
import { getThresholds } from "../handlers";
import { dataTable } from "../constants/tableNames";
import { dynamodbClient, PutItemCommand } from "../utils/dynamoClient";
import { saveAveragesToDB } from "../handlers";

export const handleMsg = async (thisConnectionId: string, body: string) => {
    try {
        const parsed = JSON.parse(body);

        // Відправляємо отримане повідомлення для дебагу
        await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: `Received body: ${body}` }));

        // Перевіряємо тип і формат тіла повідомлення
        if (parsed.type !== "sensor" || !Array.isArray(parsed.body)) {
            await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: "Invalid type or body format" }));
            return responseOK;
        }

        const thresholds = await getThresholds();
        await sendMessage(thisConnectionId, JSON.stringify({ type: "thresholds", body: thresholds }));


        // Збираємо дані для кожного сенсора
        for (const sensorData of parsed.body) {
            const { id, timestamp, temperature, humidity, pressure } = sensorData;

            if (!id || !timestamp || !temperature || !humidity || !pressure) {
                await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: "Missing required sensor data" }));
                return responseOK;
            }

            // Збереження даних в таблицю DynamoDB
            try {
                await dynamodbClient.send(
                    new PutItemCommand({
                        TableName: dataTable,
                        Item: {
                            id: { N: id.toString() },
                            timestamp: { N: timestamp.toString() },
                            temperature: { N: temperature.toString() },
                            humidity: { N: humidity.toString() },
                            pressure: { N: pressure.toString() },
                        },
                    })
                );
                await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: "Successfully saved sensor data to DynamoDB" }));
            } catch (dynamoErr) {
                console.error("DynamoDB error:", dynamoErr);
                await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: `DynamoDB error: ${dynamoErr}` }));
            }
        }

        try {
            await saveAveragesToDB(parsed.body, thresholds);
            await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: "Successfully saved averages to DynamoDB" }));
        } catch (avgErr) {
            console.error("Average saving error:", avgErr);
            await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: `Average saving error: ${avgErr}` }));
        }

        return responseOK;
    } catch (err) {
        console.error("handleMsg error:", err);
        await sendMessage(thisConnectionId, JSON.stringify({ type: "debug", body: `General error: ${err}` }));
        return { statusCode: 500, body: "Internal Server Error" };
    }
};