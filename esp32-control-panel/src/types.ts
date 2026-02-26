export type SensorData = {
    timestamp: number;
    temperature: number;
    humidity: number;
    pressure: number;
  };
  
  export type MessageBody = {
    action: string;
    type: string;
    body: SensorData | any;
  };
  
  export type CriticalSensorKey = "temperature" | "humidity" | "pressure";
  