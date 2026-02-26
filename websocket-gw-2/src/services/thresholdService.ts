import { dynamodbClient, ScanCommand, PutItemCommand, QueryCommand } from "../utils/dynamoClient";
import { thresholdsTable } from "../constants/tableNames";
import { sendMessage } from "../utils/wsUtils";
import { APIGatewayProxyResult } from "aws-lambda";



export const getThresholds = async () => {
    // Перевіряємо, чи є дані в таблиці
    const scanResult = await dynamodbClient.send(
        new ScanCommand({ TableName: thresholdsTable })
    );

    if (!scanResult.Items || scanResult.Items.length === 0) {
        // Додаємо дефолтні значення, якщо таблиця порожня
        const timestamp = Date.now();
        for (const t of DEFAULT_THRESHOLDS) {
            await dynamodbClient.send(
                new PutItemCommand({
                    TableName: thresholdsTable,
                    Item: {
                        metric: { S: t.metric },
                        min: { N: t.min.toString() },
                        max: { N: t.max.toString() },
                        timestamp: { N: timestamp.toString() },
                    },
                })
            );
        }
    }

    const latestThresholds: Record<string, Threshold> = {};

    for (const t of DEFAULT_THRESHOLDS) {
        const queryResult = await dynamodbClient.send(
            new QueryCommand({
                TableName: thresholdsTable,
                KeyConditionExpression: "metric = :metric",
                ExpressionAttributeValues: {
                    ":metric": { S: t.metric },
                },
                ScanIndexForward: false,
                Limit: 1,
            })
        );

        if (queryResult.Items && queryResult.Items.length > 0) {
            const item = queryResult.Items[0];
            latestThresholds[t.metric] = {
                min: Number(item.min.N),
                max: Number(item.max.N),
                timestamp: Number(item.timestamp.N),
            };
        } else {
            // fallback якщо чомусь не повернулося значення
            latestThresholds[t.metric] = {
                min: t.min,
                max: t.max,
                timestamp: Date.now(),
            };
        }
    }

    return latestThresholds;
};

const getThresholdsInLastMinutes = async (minutes: number, connectionId: string) => {
    const now = Date.now();
    const cutoffTime = now - minutes * 60 * 1000;

    const result = await dynamodbClient.send(
        new ScanCommand({ TableName: thresholdsTable })
    );

    const parsedItems = result.Items?.map(item => ({
        metric: item.metric.S!,
        min: Number(item.min.N),
        max: Number(item.max.N),
        timestamp: Number(item.timestamp.N),
    })) || [];

    // Отфільтровуємо всі записи, що оновлені за останні N хвилин
    const recentItems = parsedItems.filter(item => item.timestamp >= cutoffTime);

    // Якщо в результаті фільтрації порожній масив, повертаємо останній запис для кожної метрики
    if (recentItems.length === 0) {
        const lastRecordsByMetric: Record<string, any> = {};

        parsedItems.forEach(item => {
            // Якщо ще немає запису для цієї метрики або поточний запис має пізніший timestamp
            if (!lastRecordsByMetric[item.metric] || item.timestamp > lastRecordsByMetric[item.metric].timestamp) {
                lastRecordsByMetric[item.metric] = item;
            }
        });

        // Повертаємо останні записи для кожної метрики
        return Object.values(lastRecordsByMetric);
    }

    // Відправляємо повідомлення на фронтенд з інформацією про межі
    await sendMessage(connectionId, JSON.stringify({
        action: "thresholds",
        type: "info",
        body: {
            message: `Searching for thresholds with timestamps between ${new Date(cutoffTime).toISOString()} (${cutoffTime}) and ${new Date(now).toISOString()} (${now})`,
            cutoffTime,
            currentTime: now,
            count: recentItems.length
        }
    }));

    return recentItems;
};

export const handleThresholds = async (connectionId: string): Promise<APIGatewayProxyResult> => {
    try {
        let result = await dynamodbClient.send(
            new ScanCommand({ TableName: thresholdsTable })
        );

        if (!result.Items || result.Items.length === 0) {
            const defaultThresholds = [
                { metric: "temperature", min: 15, max: 25 },
                { metric: "humidity", min: 40, max: 60 },
                { metric: "pressure", min: 980, max: 1030 },
            ];

            const now = Date.now();

            for (const threshold of defaultThresholds) {
                await dynamodbClient.send(
                    new PutItemCommand({
                        TableName: thresholdsTable,
                        Item: {
                            metric: { S: threshold.metric },
                            timestamp: { N: now.toString() },
                            min: { N: threshold.min.toString() },
                            max: { N: threshold.max.toString() },
                        },
                    })
                );
            }
        }

        // Тепер викликаємо нову функцію на останні 5 хвилин
        const data = await getThresholdsInLastMinutes(60, connectionId);

        await sendMessage(connectionId, JSON.stringify({
            action: "thresholds",
            type: "data",
            body: data,
        }));

        return responseOK;
    } catch (err) {
        console.error("Error in handleThresholds:", err);
        return {
            statusCode: 500,
            body: "Internal Server Error",
        };
    }
};


export const handleUpdateThresholds = async (connectionId: string, body: any): Promise<APIGatewayProxyResult> => {
    const thresholds = body?.body;
    const timestamp = Date.now();

    if (!Array.isArray(thresholds)) {
        await sendMessage(connectionId, JSON.stringify({
            action: "updateThresholds",
            type: "error",
            body: "Invalid format: expected array in 'body.body'",
        }));
        return { statusCode: 400, body: "Invalid format" };
    }

    try {
        const allowedMetrics = ["temperature", "humidity", "pressure"];



        for (const entry of thresholds) {
            const { metric, min, max } = entry;

            if (!allowedMetrics.includes(metric) || typeof min !== "number" || typeof max !== "number") {
                continue;
            }

            // Створюємо новий timestamp


            // Зберігаємо нові дані, використовуючи унікальний timestamp
            await dynamodbClient.send(
                new PutItemCommand({
                    TableName: thresholdsTable,
                    Item: {
                        metric: { S: metric },
                        timestamp: { N: timestamp.toString() },
                        min: { N: min.toString() },
                        max: { N: max.toString() },
                        updatedAt: { N: timestamp.toString() },
                    },
                })
            );
        }

        await sendMessage(connectionId, JSON.stringify({
            action: "updateThresholds",
            type: "success",
            body: "Thresholds updated successfully",
        }));

        return responseOK;
    } catch (err) {
        console.error("Error in handleUpdateThresholds:", err);
        await sendMessage(connectionId, JSON.stringify({
            action: "updateThresholds",
            type: "error",
            body: "Internal Server Error",
        }));

        return { statusCode: 500, body: "Internal Server Error" };
    }
};