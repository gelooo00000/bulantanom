// BulanTanom soil sensor: ESP32 (ESP-32U) + MAX3485 + 7-in-1 RS485 soil probe.
//
// Reads the probe over Modbus RTU and prints one JSON line every two seconds
// on the USB serial port, which the Crop Recommendation page reads in Chrome
// or Edge on a computer, and over Bluetooth Low Energy as "BulanTanom-Soil"
// (Nordic UART service, TX notifications in 20-byte chunks), which it reads
// in Chrome on Android:
//
//   {"moisture":65.2,"temperature":28.5,"ec":850,"ph":6.5,"n":120,"p":80,"k":150}
//
// or {"error":"no_response"} when the probe does not answer. Wiring and setup
// are in README.md beside this file. No extra libraries are needed: the BLE
// library comes with the ESP32 board package.

#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>

// --- Wiring (change these to match your board) -----------------------------
const int RS485_RX_PIN = 16;  // MAX3485 RO
const int RS485_TX_PIN = 17;  // MAX3485 DI
const int RS485_DE_RE_PIN = 4;  // MAX3485 DE and RE, tied together

// --- Probe settings ----------------------------------------------------------
const uint8_t PROBE_ADDRESS = 1;
const uint32_t PROBE_BAUD = 4800;
const uint16_t FIRST_REGISTER = 0x0000;
const uint16_t REGISTER_COUNT = 7;  // moisture, temp, EC, pH, N, P, K
const uint32_t RESPONSE_TIMEOUT_MS = 500;

// --- Output ------------------------------------------------------------------
const uint32_t USB_BAUD = 115200;  // The website opens the port at this speed.
const uint32_t POLL_INTERVAL_MS = 2000;

// --- Bluetooth -----------------------------------------------------------------
// The website's Bluetooth chooser lists only devices with this exact name.
const char *BLE_NAME = "BulanTanom-Soil";
const char *UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const char *UART_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";  // notify
const size_t BLE_CHUNK = 20;  // Fits the smallest BLE packet (default MTU 23).

HardwareSerial RS485(2);
BLECharacteristic *bleTx = nullptr;
volatile bool bleConnected = false;

class ConnectionCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { bleConnected = true; }
  void onDisconnect(BLEServer *) override {
    bleConnected = false;
    BLEDevice::startAdvertising();  // Ready for the next phone.
  }
};

void startBluetooth() {
  BLEDevice::init(BLE_NAME);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ConnectionCallbacks());
  BLEService *service = server->createService(UART_SERVICE_UUID);
  bleTx = service->createCharacteristic(UART_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  bleTx->addDescriptor(new BLE2902());
  service->start();
  // Only the name is advertised: the name plus a 128-bit UUID would not fit
  // in one advertising packet, and the website finds the sensor by name.
  BLEDevice::startAdvertising();
}

// One JSON line, to USB and, while a phone is connected, over Bluetooth.
void sendLine(const char *line) {
  Serial.print(line);
  if (!bleConnected || bleTx == nullptr) return;
  size_t length = strlen(line);
  for (size_t sent = 0; sent < length; sent += BLE_CHUNK) {
    size_t size = min(BLE_CHUNK, length - sent);
    bleTx->setValue((uint8_t *)(line + sent), size);
    bleTx->notify();
    delay(10);  // Give the BLE stack time to send each chunk.
  }
}

uint16_t modbusCrc(const uint8_t *data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (int bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
    }
  }
  return crc;
}

// Reads REGISTER_COUNT holding registers into `values`. False on no answer,
// a short answer or a bad checksum.
bool readRegisters(uint16_t *values) {
  uint8_t request[8] = {
      PROBE_ADDRESS, 0x03,
      (uint8_t)(FIRST_REGISTER >> 8), (uint8_t)(FIRST_REGISTER & 0xFF),
      (uint8_t)(REGISTER_COUNT >> 8), (uint8_t)(REGISTER_COUNT & 0xFF),
      0, 0};
  uint16_t crc = modbusCrc(request, 6);
  request[6] = crc & 0xFF;  // Modbus sends the CRC low byte first.
  request[7] = crc >> 8;

  while (RS485.available()) RS485.read();  // Drop anything stale.

  digitalWrite(RS485_DE_RE_PIN, HIGH);  // Transmit.
  RS485.write(request, sizeof(request));
  RS485.flush();
  digitalWrite(RS485_DE_RE_PIN, LOW);  // Listen.

  const size_t expected = 5 + REGISTER_COUNT * 2;  // addr, fn, count, data, crc
  uint8_t response[5 + REGISTER_COUNT * 2];
  size_t received = 0;
  uint32_t started = millis();
  while (received < expected && millis() - started < RESPONSE_TIMEOUT_MS) {
    if (RS485.available()) response[received++] = RS485.read();
  }
  if (received < expected) return false;
  if (response[0] != PROBE_ADDRESS || response[1] != 0x03 ||
      response[2] != REGISTER_COUNT * 2) {
    return false;
  }
  uint16_t got = response[expected - 2] | (response[expected - 1] << 8);
  if (got != modbusCrc(response, expected - 2)) return false;

  for (uint16_t i = 0; i < REGISTER_COUNT; i++) {
    values[i] = (response[3 + i * 2] << 8) | response[4 + i * 2];
  }
  return true;
}

void setup() {
  Serial.begin(USB_BAUD);
  pinMode(RS485_DE_RE_PIN, OUTPUT);
  digitalWrite(RS485_DE_RE_PIN, LOW);
  RS485.begin(PROBE_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  startBluetooth();
}

void loop() {
  uint16_t r[REGISTER_COUNT];
  if (readRegisters(r)) {
    // Temperature is signed: below 0 °C the probe sends two's complement.
    float moisture = r[0] / 10.0;
    float temperature = (int16_t)r[1] / 10.0;
    float ph = r[3] / 10.0;
    char line[128];
    snprintf(line, sizeof(line),
             "{\"moisture\":%.1f,\"temperature\":%.1f,\"ec\":%u,\"ph\":%.1f,"
             "\"n\":%u,\"p\":%u,\"k\":%u}\n",
             moisture, temperature, r[2], ph, r[4], r[5], r[6]);
    sendLine(line);
  } else {
    sendLine("{\"error\":\"no_response\"}\n");
  }
  delay(POLL_INTERVAL_MS);
}
