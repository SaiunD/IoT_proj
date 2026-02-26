#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>

#define TINY_GSM_MODEM_SIM7600
#define TINY_GSM_USE_GPRS true
#define TINY_GSM_USE_WIFI false
#include <TinyGsmClient.h>

#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <time.h>

// --- SIM7600 SETTINGS ---
#define SerialMon Serial
#define MODEM_RX 16
#define MODEM_TX 17
#define SIM_BAUD 9600
#define POWER_PIN 34

#define APN "www.kyivstar.net"
#define GPRS_USER ""
#define GPRS_PASS ""

HardwareSerial simSerial(2);
TinyGsm modem(simSerial);
TinyGsmClient client(modem); // WebSocket over GPRS

WebSocketsClient wsClient;

// --- Power Detection ---
#define POWER_LED_PIN 25

enum PowerSource
{
  MAIN,
  BACKUP
};
PowerSource currentPower = MAIN;
PowerSource lastSentPower = MAIN;

// --- Timers ---
unsigned long lastPowerCheck = 0;
const unsigned long powerCheckInterval = 10000;
unsigned long lastSensorSend = 0;
const unsigned long sensorInterval = 30000;

// --- BME280 ---
#define SDA_PIN 18
#define SCL_PIN 19
Adafruit_BME280 bme1;
Adafruit_BME280 bme2;

// --- Constants ---
#define JSON_DOC_SIZE 2048
#define MSG_SIZE 512
String phoneNumber = "";

// --- SMS ---
void sendSMS(const String &message)
{
  simSerial.println("AT+CMGF=1");
  delay(100);
  simSerial.print("AT+CMGS=\"");
  simSerial.print(phoneNumber); // Використовуємо номер телефону
  simSerial.println("\"");
  delay(100);
  simSerial.print(message);
  simSerial.write(26);
  delay(5000);
  Serial.println("[INFO] SMS sent");
}

// --- Power Source Detection ---
PowerSource detectPowerSource()
{
  return digitalRead(POWER_PIN) == LOW ? MAIN : BACKUP;
}

void sendPowerStatus(PowerSource power)
{
  StaticJsonDocument<JSON_DOC_SIZE> doc;
  doc["action"] = "powermsg";
  JsonObject body = doc.createNestedObject("body");
  body["source"] = (power == MAIN) ? "main" : "backup";
  body["timestamp"] = time(nullptr);

  char buffer[MSG_SIZE];
  serializeJson(doc, buffer);
  wsClient.sendTXT(buffer);

  String smsText = "Power source changed to: ";
  smsText += (power == MAIN) ? "MAIN" : "BACKUP";
  sendSMS(smsText);

  digitalWrite(POWER_LED_PIN, power == MAIN ? HIGH : LOW);

  Serial.println("[INFO] Power status sent: " + smsText);
}

// --- Send Sensor Data ---
void sendSensorData()
{
  time_t now = time(nullptr);
  StaticJsonDocument<JSON_DOC_SIZE> doc;

  doc["action"] = "msg";
  doc["type"] = "sensor";
  JsonArray sensors = doc.createNestedArray("body");

  for (int i = 0; i < 2; i++)
  {
    Adafruit_BME280 &bme = (i == 0) ? bme1 : bme2;
    JsonObject sensor = sensors.createNestedObject();
    sensor["id"] = i + 1;
    sensor["timestamp"] = now;
    sensor["temperature"] = bme.readTemperature();
    sensor["humidity"] = bme.readHumidity();
    sensor["pressure"] = bme.readPressure() / 100.0F;
  }

  char buffer[MSG_SIZE];
  serializeJson(doc, buffer);
  wsClient.sendTXT(buffer);
  Serial.println("[INFO] Sensor data sent");
}

// --- WebSocket Message Handling ---
void sendErrorMessage(const char *error)
{
  char msg[MSG_SIZE];
  sprintf(msg, "{\"action\":\"msg\",\"type\":\"error\",\"body\":\"%s\"}", error);
  wsClient.sendTXT(msg);
}

void sendOkMessage()
{
  wsClient.sendTXT("{\"action\":\"msg\",\"type\":\"status\",\"body\":\"ok\"}");
}

uint8_t toMode(const char *val)
{
  if (strcmp(val, "output") == 0)
    return OUTPUT;
  if (strcmp(val, "input_pullup") == 0)
    return INPUT_PULLUP;
  return INPUT;
}

// --- Запит на отримання номера телефону ---
void sendGetPhoneNumberRequest()
{
  StaticJsonDocument<JSON_DOC_SIZE> doc;
  doc["action"] = "getPhone"; // Запит на отримання номера телефону
  doc["timestamp"] = time(nullptr);

  char buffer[MSG_SIZE];
  serializeJson(doc, buffer);
  wsClient.sendTXT(buffer); // Відправка запиту на сервер
  Serial.println("[INFO] Sent request to get phone number.");
}

void handleMessage(uint8_t *payload)
{
  StaticJsonDocument<JSON_DOC_SIZE> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error)
  {
    sendErrorMessage(error.c_str());
    return;
  }

  // Перевірка на дію "getPhoneNumber" з отриманим номером телефону
  if (strcmp(doc["action"], "getPhoneNumber") == 0)
  {
    if (!doc["body"]["phoneNumber"].is<String>())
    {
      sendErrorMessage("invalid phone number format");
      return;
    }
    phoneNumber = doc["body"]["phoneNumber"].as<String>(); // Оновлення змінної phoneNumber
    sendOkMessage();
    Serial.println("[INFO] Phone number updated: " + phoneNumber);
    return;
  }

  // Інші оброблені команди
  if (!doc["type"].is<const char *>())
  {
    sendErrorMessage("invalid message type format");
    return;
  }

  if (strcmp(doc["type"], "cmd") == 0)
  {
    if (!doc["body"].is<JsonObject>())
    {
      sendErrorMessage("invalid command body");
      return;
    }

    if (strcmp(doc["body"]["type"], "pinMode") == 0)
    {
      pinMode(doc["body"]["pin"], toMode(doc["body"]["mode"]));
      sendOkMessage();
      return;
    }

    if (strcmp(doc["body"]["type"], "digitalWrite") == 0)
    {
      digitalWrite(doc["body"]["pin"], doc["body"]["value"]);
      sendOkMessage();
      return;
    }

    if (strcmp(doc["body"]["type"], "digitalRead") == 0)
    {
      int value = digitalRead(doc["body"]["pin"]);
      char msg[MSG_SIZE];
      sprintf(msg, "{\"action\":\"msg\",\"type\":\"output\",\"body\":%d}", value);
      wsClient.sendTXT(msg);
      return;
    }

    if (strcmp(doc["action"], "alert") == 0 && strcmp(doc["type"], "sensorAlert") == 0)
    {
      const char *msg = doc["body"]["message"];
      sendSMS(msg);
      Serial.println("[INFO] Received alert and sent SMS: " + String(msg));
      return;
    }

    sendErrorMessage("unsupported command type");
    return;
  }

  sendErrorMessage("unsupported message type");
}

// --- WebSocket Events ---
void onWSEvent(WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_CONNECTED:
    Serial.println("[INFO] WS Connected");
    break;
  case WStype_DISCONNECTED:
    Serial.println("[WARN] WS Disconnected");
    break;
  case WStype_TEXT:
    Serial.printf("[INFO] WS Message: %s\n", payload);
    handleMessage(payload);
    break;
  }
}

// --- Setup ---
void setup()
{
  SerialMon.begin(115200);
  delay(10);

  pinMode(POWER_PIN, INPUT);
  pinMode(POWER_LED_PIN, OUTPUT);
  digitalWrite(POWER_LED_PIN, LOW); // початково викл.

  // --- SIM7600 INIT ---
  simSerial.begin(SIM_BAUD, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(3000);
  SerialMon.println("[INFO] Initializing modem...");
  modem.restart();
  modem.init();

  if (!modem.waitForNetwork())
  {
    SerialMon.println("[ERROR] No network");
    while (true)
      ;
  }
  SerialMon.println("[INFO] Network connected");

  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS))
  {
    SerialMon.println("[ERROR] GPRS connect failed");
    while (true)
      ;
  }
  SerialMon.println("[INFO] GPRS connected");

  // --- WebSocket ---
  wsClient.beginSSL("tcueze9sic.execute-api.eu-central-1.amazonaws.com", 443, "/dev", "", "wss");
  wsClient.onEvent(onWSEvent);

  // --- Time ---
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  while (time(nullptr) < 8 * 3600)
    delay(1000);

  // --- I2C + Sensors ---
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!bme1.begin(0x76))
    SerialMon.println("[ERROR] BME280 #1 not found!");
  if (!bme2.begin(0x77))
    SerialMon.println("[ERROR] BME280 #2 not found!");
}

// --- Loop ---
void loop()
{
  wsClient.loop();

  // Надсилання запиту на номер телефону через WebSocket
  static bool phoneNumberRequested = false;

  if (!phoneNumberRequested)
  {
    sendGetPhoneNumberRequest(); // Відправити запит на номер телефону
    phoneNumberRequested = true;
  }

  unsigned long now = millis();

  if (now - lastPowerCheck >= powerCheckInterval)
  {
    currentPower = detectPowerSource();
    if (currentPower != lastSentPower)
    {
      sendPowerStatus(currentPower);
      lastSentPower = currentPower;
    }
    lastPowerCheck = now;
  }

  if (now - lastSensorSend >= sensorInterval)
  {
    sendSensorData();
    lastSensorSend = now;
  }
}
