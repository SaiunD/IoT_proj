import React from "react";
import { useSensorData } from "./hooks_/useSensorData";
import SensorChart from "./components_/SensorChart";
import LoginModal from "./components_/LoginModal";
import ControlPanel from "./components_/ControlPanel";

function App() {
  const {
    filteredData,
    timeRange,
    setTimeRange,
    criticalValues,
    isCritical,
    canEditCritical,
    showLoginModal,
    setShowLoginModal,
    passwordInput,
    setPasswordInput,
    handleCriticalChange,
    handlePasswordSubmit,
    exportToCsv,
  } = useSensorData();

  return (
    <div className="App p-6 min-h-screen bg-gray-100 space-y-8">
      <h1 className="text-4xl font-bold text-center text-blue-700">ESP32 Sensor Dashboard</h1>

      <ControlPanel
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        exportToCsv={exportToCsv}
        canEditCritical={canEditCritical}
        setShowLoginModal={setShowLoginModal}
      />

      {showLoginModal && (
        <LoginModal
          passwordInput={passwordInput}
          setPasswordInput={setPasswordInput}
          onSubmit={handlePasswordSubmit}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Sensor Charts */}
        <div className="flex-1 space-y-8">
          {(["temperature", "humidity", "pressure"] as (keyof typeof criticalValues)[]).map((key) => (
            <SensorChart
              timeRange={timeRange}
              key={key}
              title={
                key === "temperature"
                  ? "Температура (°C)"
                  : key === "humidity"
                  ? "Вологість (%)"
                  : "Тиск (hPa)"
              }
              data={filteredData} // Передаємо лише відфільтровані дані
              dataKey={key}
              strokeColor={
                key === "temperature"
                  ? "#ff7300"
                  : key === "humidity"
                  ? "#00aaff"
                  : "#00cc66"
              }
              criticalMin={criticalValues[key].min}
              criticalMax={criticalValues[key].max}
              onCriticalChange={(sensor, bound, value) =>
                canEditCritical
                  ? handleCriticalChange(sensor, bound, value)
                  : setShowLoginModal(true)
              }
              canEdit={canEditCritical}
            />
          ))}
        </div>

        {/* Right: Alerts - Вимкнули для перевірки */}
        {/* <div className="w-full lg:w-80">
          <div className="bg-white rounded-2xl shadow-md p-4 h-full">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Алерти</h2>
            <AlertLog alerts={alertHistory} />
          </div>
        </div> */}
      </div>
    </div>
  );
}

export default App;
