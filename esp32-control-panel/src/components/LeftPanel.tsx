import React, { useEffect, useState } from "react";
import AlertPanel from "./AlertPanel";
import { useWebSocketConnection } from "../hooks/useWebSocketConnection";

interface PowerAlertMessage {
  type: string;
  source?: string;
  status?: string;
  timestamp?: number;
}

const LeftPanel: React.FC = () => {
  const [powerSource, setPowerSource] = useState<string | null>(null);
  const { lastJsonMessage } = useWebSocketConnection();

  useEffect(() => {
    const msg = lastJsonMessage as PowerAlertMessage;
    if (msg?.type === "powerAlert") {
      setPowerSource(msg.source || null);
    }
  }, [lastJsonMessage]);

  const isMain = powerSource === "main";
  const isBackup = powerSource === "backup";

  return (
    <div className="w-80 h-screen bg-white dark:bg-zinc-900 shadow-lg rounded-lg p-6 hidden sm:block">
    {/* Заголовок для джерела живлення */}
      

      {/* Блок джерела живлення */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isMain
                ? "bg-green-400"
                : isBackup
                ? "bg-yellow-500"
                : "bg-gray-400"
            } transition-colors duration-300`}
          >
            <span className="text-white text-xl">🔌</span>
          </div>
          <div>
            <span className="text-lg font-medium text-zinc-600 dark:text-zinc-300">
              Джерело живлення:
            </span>
            <div className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
              {isMain
                ? "Основне живлення"
                : isBackup
                ? "Аварійне живлення"
                : "Невідомо"}
            </div>
          </div>
        </div>
      </div>

      {/* Роздільна лінія для візуального відокремлення блоків */}
      <hr className="border-t-2 border-zinc-300 dark:border-zinc-700 my-6" />

      {/* Заголовок для блоку алертів */}
      <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-4">
        Сповіщення
      </h3>

      {/* Блок алертів */}
      <AlertPanel metric="temperature" />
    </div>
  );
};

export default LeftPanel;
