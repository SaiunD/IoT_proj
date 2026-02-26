import React from 'react';
// import './SensorCards.css';

const SensorCards: React.FC = () => {
  // Тут ви можете отримувати дані з WebSocket або іншого джерела
  const temperature = 25.3;
  const humidity = 60.5;
  const pressure = 1013.2;

  return (
    <div className="sensor-cards">
      <div className="card">Температура: {temperature}°C</div>
      <div className="card">Вологість: {humidity}%</div>
      <div className="card">Тиск: {pressure} hPa</div>
    </div>
  );
};

export default SensorCards;
