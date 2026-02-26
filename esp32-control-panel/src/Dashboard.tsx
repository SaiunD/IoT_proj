import React, { useState, useEffect } from 'react';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import SettingsPanel from './components/SettingPanel';
import PasswordModal from './components/PasswordModal';
import { useThresholds } from './hooks/useThresholds';
import { ThresholdRecord } from './hooks/useThresholds';

const Dashboard: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const { thresholdHistory } = useThresholds();
  const [thresholds, setThresholds] = useState<ThresholdRecord[]>([]);

  useEffect(() => {
    const latestThresholds = thresholdHistory.map((t) => ({
      metric: t.metric,
      min: t.min,
      max: t.max,
      timestamp: Date.now(),
    }));
    setThresholds(latestThresholds);
  }, [thresholdHistory]);

  const handleThresholdUpdate = (updated: ThresholdRecord[]) => {
    setThresholds(updated);
    console.log("Оновлено порогові значення:", updated);
  };

  const openSettings = () => {
    if (isAuthorized) {
      setSettingsOpen(true);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-zinc-900 overflow-hidden transition-all">

      <LeftPanel />
      <div className="flex-1 flex transition-all duration-300 ease-in-out no-scrollbar">
        <RightPanel onSettingsClick={openSettings} />
        <div
          className={`transition-all duration-300 ease-in-out ${
            settingsOpen ? "w-[400px] opacity-100" : "w-0 opacity-0"
          } overflow-hidden border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 no-scrollbar`}
        >
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            isVisible={settingsOpen}
            initialThresholds={thresholds}
            onThresholdUpdate={handleThresholdUpdate}
          />
        </div>
      </div>

      <PasswordModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthorized(true);
          setSettingsOpen(true);
        }}
      />
    </div>
  );
};

export default Dashboard;
