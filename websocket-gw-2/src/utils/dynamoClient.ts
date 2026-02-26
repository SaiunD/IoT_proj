import { DeleteItemCommand, GetItemCommand, DynamoDBClient, PutItemCommand, ScanCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

export {
    DeleteItemCommand,
    GetItemCommand,
    DynamoDBClient,
    PutItemCommand,
    ScanCommand,
    QueryCommand,
};
export const dynamodbClient = new DynamoDBClient({});