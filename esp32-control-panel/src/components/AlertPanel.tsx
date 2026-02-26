import React, { useEffect, useState } from "react";
import { useWebSocketConnection } from "../hooks/useWebSocketConnection";

interface Alert {
  metric: string;
  timestamp: number;
  message: string;
  status: "ALERT" | "OK";
  value: number;
}

interface Props {
  metric: string;
}

const AlertPanel: React.FC<Props> = ({ metric }) => {
  const { sendJsonMessage, lastMessage, readyState } = useWebSocketConnection();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      sendJsonMessage({ action: "alertsUpdate", body: metric });
    }
  }, [readyState, sendJsonMessage, metric]);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = JSON.parse(lastMessage.data);

      if (data.type === "alertsUpdate") {
        // використовуємо body, оскільки саме там містяться алерти
        setAlerts(Array.isArray(data.body) ? data.body : []);
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  }, [lastMessage]);

  return (
    <div className="h-[80vh] p-4 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">

<ul className="space-y-3 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
        {(alerts || []).map((alert, index) => {
          const isAlert = alert.status === "ALERT";
  
          const baseClasses =
            "p-4 rounded-xl transition-all duration-300 ease-in-out shadow-md border";
  
          const alertClasses = isAlert
            ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900 dark:text-rose-100 dark:border-rose-700"
            : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-700";
  
          return (
            <li key={index} className={`${baseClasses} ${alertClasses}`}>
              <div className="font-medium">{alert.message}</div>
              <div className="text-xs opacity-70 mt-1">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AlertPanel;
