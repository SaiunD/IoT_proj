// hooks/useWebSocketConnection.ts
import useWebSocket from "react-use-websocket";

export const WS_URL = "wss://tcueze9sic.execute-api.eu-central-1.amazonaws.com/dev";

export const useWebSocketConnection = () => {
  return useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    share: true, // 💡 дуже важливо: одне підключення на всіх
  });
};
