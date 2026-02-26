import React, { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { useAverageData } from '../hooks/useAverageData';
import { useThresholds } from '../hooks/useThresholds';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection';

const metricSettings = [
  { key: 'temperature', label: 'Температура (°C)', color: '#f97316' },
  { key: 'humidity', label: 'Вологість (%)', color: '#10b981' },
  { key: 'pressure', label: 'Тиск (hPa)', color: '#3b82f6' },
] as const;

type MetricKey = (typeof metricSettings)[number]['key'];

type ChartDataPoint = {
  timestamp: number;
} & {
  [key in MetricKey]?: number;
} & {
  [key in `${MetricKey}_min` | `${MetricKey}_max`]?: number;
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const CustomDot = (min: number, max: number, key: string) => ({ cx, cy, payload }: any) => {
  const value = payload[key];
  const outOfRange = value < min || value > max;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={6}
      stroke={outOfRange ? '#e53e3e' : '#38bdf8'}
      strokeWidth={2}
      fill={outOfRange ? '#e53e3e' : '#ffffff'}
    />
  );
};


const LiveChart: React.FC = () => {
    useWebSocketConnection();
    const [timeRange, setTimeRange] = useState<number>(5 * 60 * 1000);  // Початкове значення для 5 хвилин
    const averageData = useAverageData(timeRange);
    const { thresholdHistory } = useThresholds();
  
    // Фільтрація даних
    const filteredData = useMemo<ChartDataPoint[]>(() => {
      const grouped = averageData
        .filter(d => d.timestamp >= Date.now() - timeRange)
        .reduce<Record<number, Record<string, number>>>((acc, item) => {
          if (!acc[item.timestamp]) acc[item.timestamp] = {};
          acc[item.timestamp][item.metric] = item.value;
          return acc;
        }, {});
  
      return Object.entries(grouped).map(([timestampStr, values]) => {
        const timestamp = Number(timestampStr);
        const thresholdsAtTs = metricSettings.reduce<Record<string, { min: number; max: number }>>(
          (acc, { key }) => {
            const threshold = [...thresholdHistory]
              .filter((th) => th.metric === key && th.timestamp <= timestamp)
              .sort((a, b) => b.timestamp - a.timestamp)[0];
  
            acc[key] = {
              min: threshold?.min ?? -Infinity,
              max: threshold?.max ?? Infinity,
            };
            return acc;
          }, {});
  
        return {
          timestamp,
          ...values,
          ...Object.fromEntries(
            metricSettings.flatMap(({ key }) => [
              [`${key}_min`, thresholdsAtTs[key].min],
              [`${key}_max`, thresholdsAtTs[key].max],
            ])
          )
        };
      }).sort((a, b) => a.timestamp - b.timestamp);
    }, [averageData, thresholdHistory, timeRange]);
  
    // Оновлені умови для графіка тиску
    const simplifiedData = useMemo(() => {
      const factor = timeRange >= 12 * 60 * 60 * 1000 ? 2 : timeRange >= 60 * 60 * 1000 ? 3 : 1;
      return filteredData.filter((_, idx) => idx % factor === 0);
    }, [filteredData, timeRange]);
  
    // Перевірка на тиск: можна додати специфічне налаштування для осі Y
    const last = filteredData.at(-1);
  
    return (
      <div className="live-chart-container bg-white dark:bg-zinc-800 shadow-xl rounded-2xl p-8 space-y-16">


  
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {metricSettings.map(({ key, label, color }) => (
            <div key={key} className="bg-zinc-100 dark:bg-zinc-700 p-3 rounded-lg shadow flex flex-col items-center">
              <span className="text-sm text-zinc-500 dark:text-zinc-300">{label}</span>
              <span className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100" style={{ color }}>
                {last?.[key]?.toFixed(1) ?? '–'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex space-x-4">
        {/* Оновлені кнопки */}
        <button
          className={`py-2 px-4 rounded-lg transition duration-300 ease-in-out ${
            timeRange === 5 * 60 * 1000
              ? "bg-blue-500 text-white shadow-lg transform scale-105"
              : "bg-gray-200 hover:bg-blue-100 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white"
          }`}
          onClick={() => setTimeRange(5 * 60 * 1000)}
        >
          5 хвилин
        </button>
        <button
          className={`py-2 px-4 rounded-lg transition duration-300 ease-in-out ${
            timeRange === 60 * 60 * 1000
              ? "bg-blue-500 text-white shadow-lg transform scale-105"
              : "bg-gray-200 hover:bg-blue-100 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white"
          }`}
          onClick={() => setTimeRange(60 * 60 * 1000)}
        >
          1 година
        </button>
        <button
          className={`py-2 px-4 rounded-lg transition duration-300 ease-in-out ${
            timeRange === 12 * 60 * 60 * 1000
              ? "bg-blue-500 text-white shadow-lg transform scale-105"
              : "bg-gray-200 hover:bg-blue-100 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white"
          }`}
          onClick={() => setTimeRange(12 * 60 * 60 * 1000)}
        >
          12 годин
        </button>
      </div>
  
        <div className="space-y-16 custom-scrollbar">
          {metricSettings.map(({ key, label, color }) => {
            const values = simplifiedData.map((d) => d[key]).filter((v): v is number => v !== undefined);
            const minVals = simplifiedData.map((d) => d[`${key}_min`]).filter((v): v is number => v !== undefined);
            const maxVals = simplifiedData.map((d) => d[`${key}_max`]).filter((v): v is number => v !== undefined);
  
            // Для тиску додаємо спеціальну перевірку мінімуму та максимуму
            let customMin = Math.floor(Math.min(...values, ...minVals, 0) * 0.9);
            let customMax = Math.ceil(Math.max(...values, ...maxVals, 0) * 1.1);
  
            // Якщо це тиск, то встановлюємо специфічний діапазон для Y
            if (key === 'pressure') {
              customMin = Math.max(customMin, 900);  // Мінімум для тиску, можна змінити на інше значення
              customMax = Math.min(customMax, 1100);  // Максимум для тиску
            }
  
            // Якщо для іншого ключа, використовуємо стандартний діапазон
            const currentMin = minVals.at(-1) ?? -Infinity;
            const currentMax = maxVals.at(-1) ?? Infinity;
  
            return (
              <div key={key} className="w-full h-[300px]">
                <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-200 mb-2">{label}</h3>
                {simplifiedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={simplifiedData} margin={{ top: 20, right: 40, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`${key}-fill`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
  
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={['auto', 'auto']}
                        tickFormatter={formatTime}
                        scale={timeRange > 5 * 60 * 1000 ? 'time' : 'linear'}
                      />
                      <YAxis domain={[customMin, customMax]} />
                      <Tooltip labelFormatter={formatTime} />
  
                      <Area
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#${key}-fill)`}
                        dot={CustomDot(currentMin, currentMax, key)}
                      />
  
                      {Number.isFinite(currentMin) && (
                        <ReferenceLine
                          y={currentMin}
                          stroke="#e53e3e"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
  
                      {Number.isFinite(currentMax) && (
                        <ReferenceLine
                          y={currentMax}
                          stroke="#e53e3e"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-zinc-500 mt-10">Немає даних для відображення</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  

export default LiveChart;
