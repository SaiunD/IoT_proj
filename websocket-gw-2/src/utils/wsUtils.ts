import { ApiGatewayManagementApi, GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import { handleDisconnect } from "../services/connectionService";


export const apiGatewayManagementApi = new ApiGatewayManagementApi({
    endpoint: process.env["WSSAPIGATEWAYENDPOINT"],
});

export const textEncoder = new TextEncoder();

export const sendMessage = async (connectionId: string, body: string) => {
    try {
        await apiGatewayManagementApi.postToConnection({
            ConnectionId: connectionId,
            Data: textEncoder.encode(body),
        });
    } catch (e) {
        if (e instanceof GoneException) {
            await handleDisconnect(connectionId);
            return;
        }

        throw e;
    }
};
