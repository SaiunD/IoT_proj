type SensorData = {
    id: number;
    timestamp: number;
    temperature: number;
    humidity: number;
    pressure: number;
};

const DEFAULT_THRESHOLDS = [
    { metric: "temperature", min: 8, max: 15 },
    { metric: "humidity", min: 45, max: 65 },
    { metric: "pressure", min: 950, max: 1050 },
];

interface Threshold {
    min: number;
    max: number;
    timestamp: number;
}

const responseOK = {
    statusCode: 200,
    body: "",
};