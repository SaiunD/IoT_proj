import { sendMessage } from "../utils/wsUtils";
import { getAveragesByMetricAndTimeRange } from "../handlers";

export const handleHistory = async (connectionId: string, parsed: any) => {
    try {
        const { from, to } = parsed;

        // Визначаємо метрики, для яких треба отримати дані
        const metrics = ["temperature", "humidity", "pressure"];
        const results = [];

        // Отримуємо середні значення для кожної метрики за заданий час
        for (const metric of metrics) {
            const data = await getAveragesByMetricAndTimeRange(metric, from, to);
            results.push({ metric, data });
        }

        // Відправляємо результат назад на фронтенд
        await sendMessage(connectionId, JSON.stringify({
            action: "historys",
            type: "average",
            body: results,
        }));

        return responseOK;
    } catch (err) {
        console.error("Error handling history:", err);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};