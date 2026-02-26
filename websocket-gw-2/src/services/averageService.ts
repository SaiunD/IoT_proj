import { avgDataTable, clientsTable } from "../constants/tableNames";
import { sendMessage, textEncoder, apiGatewayManagementApi } from "../utils/wsUtils";
import { dynamodbClient, PutItemCommand, DeleteItemCommand, ScanCommand, QueryCommand } from "../utils/dynamoClient";
import { checkAndCreateAlerts } from "../handlers";
import { GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import { APIGatewayProxyResult } from "aws-lambda";
import { handleAlertsHistory } from "./alertService";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";




const CHUNK_SIZE = 100;

export const saveAveragesToDB = async (
    sensorDataArray: SensorData[],
    thresholds: Record<string, Threshold>
) => {
    const count = sensorDataArray.length;

    const roundToTwo = (num: number) => Math.round(num * 100) / 100;

    // Обчислення середніх значень із округленням
    const avgTemperature = roundToTwo(
        sensorDataArray.reduce((sum, item) => sum + item.temperature, 0) / count
    );
    const avgHumidity = roundToTwo(
        sensorDataArray.reduce((sum, item) => sum + item.humidity, 0) / count
    );
    const avgPressure = roundToTwo(
        sensorDataArray.reduce((sum, item) => sum + item.pressure, 0) / count
    );

    const now = Date.now();

    const averageItems = [
        {
            metric: "temperature",
            value: avgTemperature,
            inRange:
                avgTemperature >= thresholds["temperature"].min &&
                avgTemperature <= thresholds["temperature"].max,
        },
        {
            metric: "humidity",
            value: avgHumidity,
            inRange:
                avgHumidity >= thresholds["humidity"].min &&
                avgHumidity <= thresholds["humidity"].max,
        },
        {
            metric: "pressure",
            value: avgPressure,
            inRange:
                avgPressure >= thresholds["pressure"].min &&
                avgPressure <= thresholds["pressure"].max,
        },
    ];

    // Зберігаємо середні значення в DynamoDB
    for (const item of averageItems) {
        await dynamodbClient.send(
            new PutItemCommand({
                TableName: avgDataTable,
                Item: {
                    metric: { S: item.metric },
                    timestamp: { N: now.toString() },
                    value: { N: item.value.toFixed(2) },
                    inRange: { BOOL: item.inRange },
                },
            })
        );

        // Перевірка порогів і створення алертів
        const { min, max } = thresholds[item.metric];
        await checkAndCreateAlerts(item.metric, item.value, min, max, now);
    }

    // Відправка середніх значень всім підключеним клієнтам через WebSocket
    const clientsRes = await dynamodbClient.send(new ScanCommand({ TableName: clientsTable }));
    for (const client of clientsRes.Items || []) {
        const connectionId = client.connectionId.S!;
        try {
            await apiGatewayManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: textEncoder.encode(
                    JSON.stringify({
                        type: "avg", // тип повідомлення
                        payload: averageItems, // відправка середніх значень для графіків
                    })
                ),
            });
            handleAlertsHistory(connectionId);
        } catch (e) {
            if (e instanceof GoneException) {
                await dynamodbClient.send(new DeleteItemCommand({
                    TableName: clientsTable,
                    Key: marshall({ connectionId }),
                }));
            }
        }
    }
};

export async function getAveragesByMetricAndTimeRange(
    metric: string,
    from: number,
    to: number
) {
    if (!avgDataTable) {
        throw new Error("avgDataTable is not defined in environment variables");
    }

    const response = await dynamodbClient.send(
        new QueryCommand({
            TableName: avgDataTable,
            KeyConditionExpression: "metric = :metric AND #ts BETWEEN :from AND :to",
            ExpressionAttributeNames: {
                "#ts": "timestamp",  // timestamp — зарезервоване слово, тому краще винести
            },
            ExpressionAttributeValues: {
                ":metric": { S: metric },
                ":from": { N: from.toString() },
                ":to": { N: to.toString() },
            },
        })
    );

    const items = response.Items?.map(item => ({
        timestamp: Number(item.timestamp.N),
        metric: item.metric.S,
        value: Number(item.value.N),
        inRange: item.inRange.BOOL,
    })) || [];

    return items;
}

export const exportAveragesCsvHandler = async (
    connectionId: string
): Promise<APIGatewayProxyResult> => {
    try {
        let allItems: any[] = [];

        for (const metric of ["temperature", "humidity", "pressure"]) {
            const result = await dynamodbClient.send(
                new QueryCommand({
                    TableName: avgDataTable,
                    KeyConditionExpression: "metric = :m",
                    ExpressionAttributeValues: {
                        ":m": { S: metric },
                    },
                })
            );

            const items = result.Items?.map((item) => unmarshall(item)) || [];
            allItems.push(...items);
        }

        // Надсилаємо порціями
        for (let i = 0; i < allItems.length; i += CHUNK_SIZE) {
            const chunk = allItems.slice(i, i + CHUNK_SIZE);

            await sendMessage(connectionId, JSON.stringify({
                type: "rawDataChunk",
                chunkIndex: i / CHUNK_SIZE,
                totalChunks: Math.ceil(allItems.length / CHUNK_SIZE),
                data: chunk,
            }));
        }

        // Повідомлення про завершення
        await sendMessage(connectionId, JSON.stringify({
            type: "rawDataComplete",
            totalItems: allItems.length,
        }));

        return {
            statusCode: 200,
            body: "Raw data export successful in chunks",
        };
    } catch (error) {
        await sendMessage(connectionId, JSON.stringify({
            type: "error",
            message: "Помилка при експорті даних: " + (error instanceof Error ? error.message : JSON.stringify(error)),
        }));

        return {
            statusCode: 500,
            body: "Raw data export error",
        };
    }
};