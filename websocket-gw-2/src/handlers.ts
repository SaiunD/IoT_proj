import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleConnect, handleDisconnect } from "./services/connectionService"
import { handleMsg } from "./services/messageService"
import { handleHistory } from "./services/historyService";
import { handleThresholds, handleUpdateThresholds } from "./services/thresholdService";
import { handleAlertsHistory } from "./services/alertService";
import { isPasswordValid } from "./services/settingsService";
import { handlePowerMsg } from "./services/powerService";
import { updatePhone, getPhone } from "./services/settingsService";
import { exportAveragesCsvHandler } from "./services/averageService"; 
import { sendMessage } from "./utils/wsUtils";

export const handle = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId as string;
    const routeKey = event.requestContext.routeKey as string;
    const body = event.body || "";

    switch (routeKey) {
        case "$connect":
            return handleConnect(connectionId);
        case "$disconnect":
            return handleDisconnect(connectionId);
        case "historys": {
            const parsed = JSON.parse(body);
            return handleHistory(connectionId, parsed);
        }
        case "msg":
            return handleMsg(connectionId, body);
        case "thresholds":
            return handleThresholds(connectionId);
        case "updateThresholds":
            return handleUpdateThresholds(connectionId, JSON.parse(body));
        case "alertsUpdate":
            return handleAlertsHistory(connectionId);
        case "checkPassword": {
            const { password } = JSON.parse(body);
            const isValid = await isPasswordValid(password);
            await sendMessage(connectionId, JSON.stringify({
                type: "authResult",
                success: isValid,
            }));
            return responseOK;
        }
        case "getPhone": {
            const phone = await getPhone();
            await sendMessage(connectionId, JSON.stringify({
                type: "phoneValue",
                phone, // передаємо як об'єкт
            }));
            return responseOK;
        }
        case "updatePhone": {
            const parsed = JSON.parse(body);
            const { phone } = parsed.body;
            await updatePhone(phone);
            await sendMessage(connectionId, JSON.stringify({ type: "updateSuccess", field: "phone" }));
            return responseOK;
        }
        case "powermsg":
            return handlePowerMsg(connectionId, JSON.parse(body));

        case "exportAvgCsv":
            return exportAveragesCsvHandler(connectionId);
    }

    return {
        statusCode: 200,
        body: "",
    };
};