import { dynamodbClient, PutItemCommand, DeleteItemCommand } from "../utils/dynamoClient";
import { clientsTable } from "../constants/tableNames";
import { APIGatewayProxyResult } from "aws-lambda";

export const handleConnect = async (connectionId: string): Promise<APIGatewayProxyResult> => {
    await dynamodbClient.send(
        new PutItemCommand({
            TableName: clientsTable,
            Item: {
                connectionId: {
                    S: connectionId,
                },
            },
        }),
    );

    return responseOK;
};
export const handleDisconnect = async (connectionId: string): Promise<APIGatewayProxyResult> => {
    await dynamodbClient.send(
        new DeleteItemCommand({
            TableName: clientsTable,
            Key: {
                connectionId: {
                    S: connectionId,
                },
            },
        }),
    );

    return responseOK;
};