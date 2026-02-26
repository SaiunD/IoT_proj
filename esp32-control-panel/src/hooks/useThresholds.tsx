import { useEffect, useState, useCallback, useMemo } from "react";
import { ReadyState } from "react-use-websocket";
import { useWebSocketConnection } from "./useWebSocketConnection";

export interface ThresholdRecord {
  metric: "temperature" | "humidity" | "pressure";
  min: number;
  max: number;
  timestamp: number;
}

interface ThresholdResponse {
  action: "thresholds" | "updateThresholds";
  type: "data" | "error" | "success";
  body: ThresholdRecord[] | string;
}

export function useThresholds() {
  const { lastMessage, sendMessage, readyState } = useWebSocketConnection();

  const [thresholdHistory, setThresholdHistory] = useState<ThresholdRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = useCallback(() => {
    if (readyState === ReadyState.OPEN) {
      sendMessage(JSON.stringify({ action: "thresholds" }));
    }
  }, [readyState, sendMessage]);

  useEffect(() => {
    if (!lastMessage) return;
  
    try {
      const data: ThresholdResponse = JSON.parse(lastMessage.data);
  
      if (data.action === "thresholds") {
        if (data.type === "data" && Array.isArray(data.body)) {
          setThresholdHistory(data.body);
          console.log("✅ Отримані критичні межі:", data.body); // 🔍 Логування меж
          setError(null);
        } else {
          setError(typeof data.body === "string" ? data.body : "Unknown error");
        }
        setLoading(false);
      }
  
      if (data.action === "updateThresholds" && data.type === "success") {
        fetchThresholds();
      }
  
    } catch (err) {
      setError("Parsing error");
      console.error("❌ Parsing error:", err);
    }
  }, [lastMessage, fetchThresholds]);
  

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  return {
    thresholdHistory,
    loading,
    error,
    refresh: fetchThresholds,
  };
}