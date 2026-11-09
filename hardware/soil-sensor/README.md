# Soil sensor (optional)

An ESP32 that reads a 7-in-1 RS485 soil probe and sends the readings to the
Crop Recommendation page over a USB cable (computers) or Bluetooth (Android
phones). Typing the readings in by hand still
works, and is the default.

| Part | Notes |
|---|---|
| ESP32 (ESP-32U) | Any ESP32 board works; change the pins in the sketch if yours differ |
| MAX3485 module | RS485 transceiver; runs on 3.3 V, so it is safe for the ESP32 |
| 7-in-1 RS485 soil probe | Moisture, temperature, EC, pH, N, P, K. Modbus RTU, address 1, 4800 baud |
| Power for the probe | Most of these probes need 5–30 V (check yours). The ESP32's 3.3 V pin is not enough |

## Wiring

| From | To |
|---|---|
| MAX3485 RO | ESP32 GPIO16 |
| MAX3485 DI | ESP32 GPIO17 |
| MAX3485 DE and RE (joined) | ESP32 GPIO4 |
| MAX3485 VCC / GND | ESP32 3.3 V / GND |
| MAX3485 A / B | Probe A (often yellow) / B (often blue) |
| Probe power + / − | Probe supply + / −, with − also joined to ESP32 GND |

If readings never arrive, swap A and B first: it is the most common mistake.

## Upload

1. Install the Arduino IDE and add ESP32 support (Boards Manager: "esp32" by Espressif).
2. Open `soil-sensor.ino`, pick your ESP32 board and its port, and upload.
3. Open the Serial Monitor at 115200 baud. A JSON line should appear every two
   seconds. **Close the Serial Monitor afterwards**, or the website cannot open
   the port.

## Use it on BulanTanom

**On a computer:** use Chrome or Edge. On Crop Recommendation, choose **Use the
Arduino sensor**, push the probe into the soil, plug in the ESP32, and press
**Connect by USB**.

**On an Android phone:** use Chrome with Bluetooth on (and Location too, on
Android 11 and older). Power the ESP32, choose **Use the Arduino sensor**, press
**Connect by Bluetooth** and pick **BulanTanom-Soil**. The ESP32 advertises
under that name as soon as it starts. If the phone does not list it, an app such
as nRF Connect can check whether it is visible.

Safari and iPhones support neither USB nor Bluetooth from a web page. The probe fills in all seven readings
and the recommendation starts straight away.

The probe's N, P and K are estimates, not lab results.
