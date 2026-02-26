import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, X, Settings as SettingsIcon, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useThresholds, ThresholdRecord } from "@/hooks/useThresholds";
import { useWebSocketConnection } from "@/hooks/useWebSocketConnection";
import { format } from "date-fns";

interface SettingsPanelProps {
  onClose: () => void;
  isVisible: boolean;
  initialThresholds: ThresholdRecord[];
  onThresholdUpdate: (updated: ThresholdRecord[]) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onClose,
  isVisible,
  initialThresholds,
  onThresholdUpdate,
}) => {
  const { sendMessage, lastMessage } = useWebSocketConnection();
  const { thresholdHistory, refresh } = useThresholds();

  const [localThresholds, setLocalThresholds] = useState<ThresholdRecord[]>([]);
  const [phone, setPhone] = useState("");
  const [phoneUpdatedAt, setPhoneUpdatedAt] = useState<number | null>(null);
  const [csvChunks, setCsvChunks] = useState<any[]>([]);
  const [csvReady, setCsvReady] = useState(false);

  useEffect(() => {
    const latestByMetric = Object.values(
      thresholdHistory.reduce((acc, curr) => {
        acc[curr.metric] = curr;
        return acc;
      }, {} as Record<string, ThresholdRecord>)
    );
    setLocalThresholds(latestByMetric);
  }, [thresholdHistory]);

  useEffect(() => {
    if (isVisible && sendMessage) {
      sendMessage(JSON.stringify({ action: "getPhone" }));
    }
  }, [isVisible, sendMessage]);

  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      console.log("📩 Отримано повідомлення через WebSocket:", data);

      if (data.type === "phoneValue" && data.phone) {
        const { phone: phoneNumber, updatedAt } = data.phone;
        setPhone(phoneNumber);
        setPhoneUpdatedAt(updatedAt);
      } else if (data.type === "rawDataChunk") {
        setCsvChunks((prev) => [...prev, ...data.data]);
      } else if (data.type === "rawDataComplete") {
        setCsvReady(true);
      }
    }
  }, [lastMessage]);

  const handleChange = (
    index: number,
    field: "min" | "max",
    value: string
  ) => {
    const updated = [...localThresholds];
    updated[index][field] = parseFloat(value);
    setLocalThresholds(updated);
  };

  const handleSubmitThresholds = () => {
    const validThresholds = localThresholds.filter(
      (threshold) => !isNaN(threshold.min) && !isNaN(threshold.max)
    );
    if (validThresholds.length !== localThresholds.length) {
      alert("Будь ласка, введіть правильні числові значення для мінімуму та максимуму.");
      return;
    }

    const payload = {
      action: "updateThresholds",
      type: "update",
      body: validThresholds.map((threshold) => ({
        metric: threshold.metric,
        min: threshold.min,
        max: threshold.max,
      })),
    };

    sendMessage(JSON.stringify(payload));
    refresh();
    onClose();
  };

  const handleSavePhone = () => {
    if (!phone.match(/^\+?\d{10,15}$/)) {
      alert("Введіть коректний номер телефону.");
      return;
    }

    const payload = {
      action: "updatePhone",
      type: "update",
      body: { phone },
    };

    sendMessage(JSON.stringify(payload));
    alert("Номер телефону збережено.");
  };

  const downloadCsv = (metric: string) => {
    const filtered = csvChunks.filter((item) => item.metric === metric);
    const header = "metric,timestamp,value";
    const rows = filtered.map((item) => {
      const date = new Date(item.timestamp * 1000).toLocaleString("uk-UA");
      return `${item.metric},${date},${item.value}`;
    });
    const csvContent = [header, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${metric}_data.csv`);
    link.click();
  };

  const handleExportCsv = () => {
    // Надсилаємо запит для експорту CSV
    sendMessage(JSON.stringify({ action: "exportAvgCsv" }));
    setCsvChunks([]);
    setCsvReady(false);
  };

  return (
    <div className="w-full h-full p-6 overflow-y-auto transition-opacity bg-gray-100 dark:bg-zinc-800 rounded-lg shadow-lg space-y-6 custom-scrollbar">
      <div className="flex justify-between items-center border-b border-zinc-300 dark:border-zinc-700 pb-4 mb-4">
        <div className="flex items-center gap-2 text-gray-800 dark:text-white">
          <SettingsIcon size={24} className="text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-black dark:text-white">Налаштування</h2>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-red-500 transition rounded-full p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          aria-label="Закрити"
        >
          <X size={24} />
        </button>
      </div>

      {/* Критичні значення */}
      <Card className="bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-700">
        <CardContent className="space-y-6 p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Критичні значення
          </h3>

          {localThresholds[0]?.timestamp && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Оновлено: {format(new Date(localThresholds[0].timestamp), "dd.MM.yyyy HH:mm")}
            </p>
          )}

          {localThresholds.map((t, index) => (
            <div key={t.metric} className="space-y-2">
              <p className="capitalize text-sm font-medium text-gray-600 dark:text-gray-300">
                {t.metric}
              </p>
              <div className="flex gap-4">
                <Input
                  type="number"
                  value={t.min}
                  onChange={(e) => handleChange(index, "min", e.target.value)}
                  placeholder="Min"
                  className="bg-white dark:bg-zinc-800 text-black dark:text-white"
                />
                <Input
                  type="number"
                  value={t.max}
                  onChange={(e) => handleChange(index, "max", e.target.value)}
                  placeholder="Max"
                  className="bg-white dark:bg-zinc-800 text-black dark:text-white"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSubmitThresholds}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-md px-6 py-2 flex items-center gap-2 transition"
            >
              <Save size={18} />
              Зберегти межі
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Номер телефону */}
      <Card className="bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-700">
        <CardContent className="space-y-4 p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Номер телефону для повідомлень
          </h3>
          {phone && phoneUpdatedAt && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Останнє оновлення: {format(new Date(phoneUpdatedAt), "dd.MM.yyyy HH:mm")}
            </p>
          )}
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380XXXXXXXXX"
            className="bg-white dark:bg-zinc-800 text-black dark:text-white"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSavePhone}
              className="bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-md px-6 py-2 flex items-center gap-2 transition"
            >
              <Save size={18} />
              Зберегти телефон
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Експорт CSV */}
      <Card className="bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-700">
        <CardContent className="space-y-4 p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Експорт даних у CSV
          </h3>

          {!csvReady ? (
            <Button
              onClick={handleExportCsv}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-md px-6 py-2 flex items-center gap-2"
            >
              <Download size={18} />
              Завантажити дані з сервера
            </Button>
          ) : (
            <div className="space-y-2">
              {["temperature", "humidity", "pressure"].map((metric) => (
                <Button
                  key={metric}
                  onClick={() => downloadCsv(metric)}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-4 py-2"
                >
                  Завантажити дані {metric}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
