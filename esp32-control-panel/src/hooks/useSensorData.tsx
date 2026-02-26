import { useEffect, useState } from "react";
import { useWebSocketConnection } from "./useWebSocketConnection";

type SensorData = {
  id: number;
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  receivedAt: number;
  [key: string]: number | string;
};

const SENSOR_IDS = [1, 2];
/*
export const useSensorData = () => {
  const [dataBySensor, setDataBySensor] = useState<Record<number, SensorData[]>>({});
  const { lastMessage, sendMessage } = useWebSocketConnection();

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutesAgo = now - 5 * 60;

    SENSOR_IDS.forEach(id => {
      sendMessage(JSON.stringify({
        action: "history",
        type: "sensor",
        id,
        from: fiveMinutesAgo,
        to: now,
      }));
    });
  }, [sendMessage]);

  useEffect(() => {
    if (lastMessage !== null) {

        console.log("Сире повідомлення з WebSocket:", lastMessage.data);

      try {
        const json = JSON.parse(lastMessage.data);
        console.log("Отримані дані з WebSocket:", json);

        if (json.action === "msg" && json.type === "sensor") {
          const item = json.body;
          const newData: SensorData = {
            id: item.id,
            timestamp: item.timestamp,
            temperature: item.temperature,
            humidity: item.humidity,
            pressure: item.pressure,
            receivedAt: Math.floor(Date.now() / 1000),
          };

          setDataBySensor(prev => {
            const current = prev[newData.id] || [];
            const updated = [...current, newData];
            const unique = Array.from(new Map(updated.map(d => [d.timestamp, d])).values());
            return {
              ...prev,
              [newData.id]: unique.sort((a, b) => a.timestamp - b.timestamp),
            };
          });
        }

        if (json.action === "history" && json.type === "sensor") {
          const items = json.body as SensorData[];
          if (items.length === 0) return;

          const id = items[0].id;
          const formatted = items.map(item => ({
            id,
            timestamp: item.timestamp,
            temperature: item.temperature,
            humidity: item.humidity,
            pressure: item.pressure,
            receivedAt: item.timestamp,
          }));

          setDataBySensor(prev => {
            const current = prev[id] || [];
            const combined = [...current, ...formatted];
            const unique = Array.from(new Map(combined.map(d => [d.timestamp, d])).values());
            return {
              ...prev,
              [id]: unique.sort((a, b) => a.timestamp - b.timestamp),
            };
          });
        }

      } catch (err) {
        console.error("Помилка розбору WebSocket повідомлення:", err);
      }
    }
  }, [lastMessage]);

  return dataBySensor;
};*/