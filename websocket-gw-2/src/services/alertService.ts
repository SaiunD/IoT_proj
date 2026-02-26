import { alertsTable } from "../constants/tableNames";
import { dynamodbClient, QueryCommand, PutItemCommand } from "../utils/dynamoClient";
import { sendMessage } from "../utils/wsUtils";

export const handleAlertsHistory = async (connectionId: string) => {
    try {
        const allMetrics = ["temperature", "humidity", "pressure", "power"];
        let allItems: any[] = [];

        for (const metric of allMetrics) {
            const result = await dynamodbClient.send(
                new QueryCommand({
                    TableName: alertsTable,
                    KeyConditionExpression: "PK = :pk",
                    ExpressionAttributeValues: {
                        ":pk": { S: metric },
                    },
                    ScanIndexForward: false,
                    Limit: 10, // беремо максимум 10 на кожну метрику
                })
            );

            allItems = allItems.concat(result.Items || []);
        }

        // Преобразуємо всі записи в один масив
        const alerts = allItems.map(item => ({
            timestamp: Number(item.SK.N),
            message: item.message.S,
            status: item.status.S,
        }));

        // Сортуємо по timestamp (від нових до старих)
        alerts.sort((a, b) => b.timestamp - a.timestamp);

        // Беремо тільки останні 10
        const latestAlerts = alerts.slice(0, 10);

        await sendMessage(connectionId, JSON.stringify({ type: "alertsUpdate", body: latestAlerts }));

        return responseOK;
    } catch (err) {
        console.error("handleAlertsHistory error:", err);
        await sendMessage(connectionId, JSON.stringify({ type: "error", body: "Failed to fetch alerts history" }));
        return { statusCode: 500, body: "Internal Server Error" };
    }
};


export async function checkAndCreateAlerts(
    metric: string,
    value: number,
    min: number,
    max: number,
    timestamp: number
) {
    const isInRange = value >= min && value <= max;

    if (!alertsTable) {
        throw new Error("alertsTable is not defined in environment variables");
    }

    // Отримуємо останній запис для цього метрику
    const lastAlert = await dynamodbClient.send(
        new QueryCommand({
            TableName: alertsTable,
            KeyConditionExpression: "PK = :metric",
            ExpressionAttributeValues: {
                ":metric": { S: metric },
            },
            ScanIndexForward: false, // найновіший перший
            Limit: 1,
        })
    );

    const lastStatus = lastAlert.Items?.[0]?.status?.S;

    // Визначаємо, чи потрібно створювати новий запис
    if (isInRange && lastStatus === "OK") return; // вже OK — нічого не робимо
    if (!isInRange && lastStatus === "ALERT") return; // вже ALERT — нічого не робимо

    const readableMetric =
        metric === "temperature"
            ? "Температура"
            : metric === "humidity"
                ? "Вологість"
                : metric === "pressure"
                    ? "Тиск"
                    : metric;

    const item = {
        PK: { S: metric },
        SK: { N: timestamp.toString() },
        value: { N: value.toString() },
        status: { S: isInRange ? "OK" : "ALERT" },
        message: {
            S: isInRange
                ? `${readableMetric} повернулася до норми: ${value}`
                : `${readableMetric} поза межами норми: ${value}`,
        },
    };

    await dynamodbClient.send(
        new PutItemCommand({
            TableName: alertsTable,
            Item: item,
        })
    );
}