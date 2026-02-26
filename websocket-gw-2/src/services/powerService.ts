import { dynamodbClient, QueryCommand, PutItemCommand, DeleteItemCommand, ScanCommand } from "../utils/dynamoClient";
import { alertsTable, clientsTable } from "../constants/tableNames";
import { sendMessage } from "../utils/wsUtils";
import { GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";


export async function handlePowerMsg(connectionId: string, data: any) {
    const { source, timestamp } = data.body;
    const metric = "power";

    // Отримуємо останній запис
    const lastAlert = await dynamodbClient.send(
        new QueryCommand({
            TableName: alertsTable,
            KeyConditionExpression: "PK = :metric",
            ExpressionAttributeValues: {
                ":metric": { S: metric },
            },
            ScanIndexForward: false,
            Limit: 1,
        })
    );

    const lastSource = lastAlert.Items?.[0]?.source?.S;

    // Якщо джерело не змінилося — нічого не робимо
    if (lastSource === source) return responseOK;

    // Створюємо новий запис
    const item = {
        PK: { S: metric },
        SK: { N: timestamp.toString() },
        source: { S: source },
        status: { S: source === "main" ? "OK" : "ALERT" },
        message: {
            S: source === "main"
                ? "Живлення повернулося до основного джерела"
                : "SПереключено на резервне живлення!",
        },
    };

    await dynamodbClient.send(
        new PutItemCommand({
            TableName: alertsTable,
            Item: item,
        })
    );

    // Відправляємо на фронтенд
    const clients = await dynamodbClient.send(new ScanCommand({ TableName: clientsTable }));
    const connections = clients.Items || [];

    const message = {
        type: "powerAlert",
        source,
        status: item.status.S,
        timestamp,
    };

    for (const conn of connections) {
        const connId = unmarshall(conn).connectionId;
        try {
            await sendMessage(connId, JSON.stringify(message));
        } catch (err) {
            if (err instanceof GoneException) {
                await dynamodbClient.send(new DeleteItemCommand({
                    TableName: clientsTable,
                    Key: marshall({ connectionId: connId }),
                }));
            }
        }
    }

    return responseOK;
}