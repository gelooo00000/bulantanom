// BulanTanom soil sensor: ESP32 (ESP-32U) + MAX3485 + 7-in-1 RS485 soil probe.
//
// Reads the probe over Modbus RTU and prints one JSON line every two seconds
// on the USB serial port, which the Crop Recommendation page reads in Chrome
// or Edge:
//
//   {"moisture":65.2,"temperature":28.5,"ec":850,"ph":6.5,"n":120,"p":80,"k":150}
//
// or {"error":"no_response"} when the probe does not answer. Wiring and setup
// are in README.md beside this file. No extra libraries are needed.

#include <Arduino.h>

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

HardwareSerial RS485(2);

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
}

void loop() {
  uint16_t r[REGISTER_COUNT];
  if (readRegisters(r)) {
    // Temperature is signed: below 0 °C the probe sends two's complement.
    float moisture = r[0] / 10.0;
    float temperature = (int16_t)r[1] / 10.0;
    float ph = r[3] / 10.0;
    Serial.printf(
        "{\"moisture\":%.1f,\"temperature\":%.1f,\"ec\":%u,\"ph\":%.1f,"
        "\"n\":%u,\"p\":%u,\"k\":%u}\n",
        moisture, temperature, r[2], ph, r[4], r[5], r[6]);
  } else {
    Serial.println("{\"error\":\"no_response\"}");
  }
  delay(POLL_INTERVAL_MS);
}
