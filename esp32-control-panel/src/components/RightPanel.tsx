import React from "react";
import LiveChart from "./LiveChart";

interface RightPanelProps {
  onSettingsClick: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onSettingsClick }) => {
  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
          Панель моніторингу
        </h1>
        <button
          onClick={onSettingsClick}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Налаштування
        </button>
      </div>
      <LiveChart />
    </div>
  );
};

export default RightPanel;
