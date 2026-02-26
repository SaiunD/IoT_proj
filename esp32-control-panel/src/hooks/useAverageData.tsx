import { useEffect, useState } from "react";
import { useWebSocketConnection } from "./useWebSocketConnection";

type AverageEntry = {
  timestamp: number;
  metric: string;
  value: number;
  inRange: boolean;
};

export const useAverageData = (timeRange: number) => {  // Додаємо параметр timeRange
  const [averages, setAverages] = useState<AverageEntry[]>([]);
  const { lastMessage, sendMessage, readyState } = useWebSocketConnection();

  // Запит історії
  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      const now = Date.now();
      const from = now - timeRange;  // Використовуємо timeRange

      const message = JSON.stringify({
        action: "historys",
        type: "average",
        from,
        to: now,
      });

      console.log("🟢 Sending WebSocket message:", message);
      sendMessage(message);
    } else {
      console.warn("[Thresholds] WebSocket не готовий, стан:", readyState);
    }
  }, [readyState, sendMessage, timeRange]);  // Залежність від timeRange

  // Обробка вхідних повідомлень
  useEffect(() => {
    if (!lastMessage?.data) return;
  
    try {
      const data = JSON.parse(lastMessage.data);
      console.log("🟡 Received WebSocket message:", data);
  
      // 1. Історія у вигляді груп
      if (data.action === "historys" && data.type === "average" && Array.isArray(data.body)) {
        const grouped = data.body as { metric: string; data: Omit<AverageEntry, "metric">[] }[];
  
        const items: AverageEntry[] = grouped.flatMap(group =>
          group.data.map(entry => ({
            ...entry,
            metric: group.metric,
            timestamp: entry.timestamp || Date.now(),
          }))
        );
  
        setAverages(prev => {
          const map = new Map(prev.map(i => [`${i.timestamp}-${i.metric}`, i]));
          items.forEach(item => {
            map.set(`${item.timestamp}-${item.metric}`, item);
          });
  
          const filtered = Array.from(map.values()).filter(
            item => item.timestamp >= Date.now() - timeRange
          );
  
          return filtered.sort((a, b) => a.timestamp - b.timestamp);
        });
      }
  
      // 2. Живе оновлення
      else if (data.type === "avg" && Array.isArray(data.payload)) {
        const now = Date.now();
      
        // Вказуємо тип для 'entry'
        const liveItems: AverageEntry[] = data.payload.map((entry: { metric: string; value: number; inRange: boolean }) => ({
          ...entry,
          timestamp: now,
        }));
      
        setAverages(prev => {
          const combined = [...prev, ...liveItems];
          const filtered = combined.filter(item => item.timestamp >= now - timeRange);
      
          return filtered.sort((a, b) => a.timestamp - b.timestamp);
        });
      }
  
    } catch (err) {
      console.error("❌ Error parsing WebSocket message:", err);
    }
  }, [lastMessage, timeRange]);

  return averages;
};
