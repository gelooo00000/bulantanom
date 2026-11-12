import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseSensorLine,
  readSoilSensor,
  readSoilSensorBluetooth,
  SensorError,
  toFormValues,
  type SensorReadings,
} from "@/lib/arduino/soil-sensor";

const LINE =
  '{"moisture":65.2,"temperature":28.5,"ec":850,"ph":6.5,"n":120,"p":80,"k":150}';

const READING: SensorReadings = {
  soil_moisture: 65.2,
  soil_temperature: 28.5,
  soil_conductivity: 850,
  soil_ph: 6.5,
  nitrogen: 120,
  phosphorus: 80,
  potassium: 150,
};

describe("parseSensorLine", () => {
  it("maps the firmware's keys onto the form's fields", () => {
    expect(parseSensorLine(LINE)).toEqual({ kind: "reading", readings: READING });
  });

  it("reports a probe that did not answer", () => {
    expect(parseSensorLine('{"error":"no_response"}')).toEqual({ kind: "probe_error" });
  });

  it("ignores boot messages, broken lines and missing readings", () => {
    expect(parseSensorLine("ets Jun  8 2016 00:22:57").kind).toBe("ignored");
    expect(parseSensorLine('{"moisture":65.2,').kind).toBe("ignored");
    expect(parseSensorLine('{"moisture":65.2}').kind).toBe("ignored");
  });
});

describe("toFormValues", () => {
  it("formats the readings as the form's text", () => {
    expect(toFormValues({ ...READING, soil_ph: 7 })).toMatchObject({
      soil_ph: "7.0",
      soil_conductivity: "850",
    });
  });
});

function fakePort(lines: string[]) {
  const bytes = new TextEncoder().encode(lines.join("\n") + "\n");
  const close = vi.fn().mockResolvedValue(undefined);
  const port = {
    open: vi.fn().mockResolvedValue(undefined),
    close,
    readable: new ReadableStream<Uint8Array>({
      start(controller) {
        // Split mid-line, as a real serial port does.
        controller.enqueue(bytes.slice(0, 20));
        controller.enqueue(bytes.slice(20));
        controller.close();
      },
    }),
  };
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: { requestPort: vi.fn().mockResolvedValue(port) },
  });
  return port;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serial");
});

describe("readSoilSensor", () => {
  it("returns the first reading as it was sent and closes the port", async () => {
    const port = fakePort(["boot message", LINE, LINE.replace("6.5", "7.1")]);
    await expect(readSoilSensor()).resolves.toEqual(READING);
    expect(port.close).toHaveBeenCalled();
  });

  it("says when the probe never answered", async () => {
    fakePort(['{"error":"no_response"}', '{"error":"no_response"}']);
    await expect(readSoilSensor()).rejects.toMatchObject({ code: "probe_not_answering" });
  });

  it("shows what a different sketch sent instead of readings", async () => {
    fakePort(["Moisture: 65.2 %", "Temp: 28.5 C"]);
    await expect(readSoilSensor()).rejects.toMatchObject({
      code: "unrecognized",
      received: "Temp: 28.5 C",
    });
  });

  it("says nothing arrived when the port stays silent", async () => {
    fakePort([]);
    await expect(readSoilSensor()).rejects.toMatchObject({ code: "no_data" });
  });

  it("says when the browser has no Web Serial", async () => {
    await expect(readSoilSensor()).rejects.toBeInstanceOf(SensorError);
    await expect(readSoilSensor()).rejects.toMatchObject({ code: "unsupported" });
  });
});

type FakeBle = {
  device: EventTarget & { gatt: { connected: boolean; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } };
  requestDevice: ReturnType<typeof vi.fn>;
};

/**
 * A fake "BulanTanom-Soil" that notifies `lines` in 20-byte chunks once
 * notifications start. `dropAfter` disconnects after that many chunks.
 */
function fakeBluetooth(lines: string[], options: { dropAfter?: number } = {}): FakeBle {
  const bytes = new TextEncoder().encode(lines.map((line) => line + "\n").join(""));
  const characteristic = Object.assign(new EventTarget(), {
    value: null as DataView | null,
    startNotifications: vi.fn(async () => {
      queueMicrotask(() => {
        for (let i = 0, sent = 0; i < bytes.length; i += 20, sent += 1) {
          if (options.dropAfter !== undefined && sent === options.dropAfter) {
            device.gatt.connected = false;
            device.dispatchEvent(new Event("gattserverdisconnected"));
            return;
          }
          characteristic.value = new DataView(bytes.slice(i, i + 20).buffer);
          characteristic.dispatchEvent(new Event("characteristicvaluechanged"));
        }
      });
    }),
    stopNotifications: vi.fn().mockResolvedValue(undefined),
  });
  const server = {
    getPrimaryService: vi.fn().mockResolvedValue({
      getCharacteristic: vi.fn().mockResolvedValue(characteristic),
    }),
  };
  const device = Object.assign(new EventTarget(), {
    gatt: {
      connected: false,
      connect: vi.fn(async () => {
        device.gatt.connected = true;
        return server;
      }),
      disconnect: vi.fn(() => {
        device.gatt.connected = false;
      }),
    },
  });
  const requestDevice = vi.fn().mockResolvedValue(device);
  Object.defineProperty(navigator, "bluetooth", {
    configurable: true,
    value: { requestDevice, getAvailability: vi.fn().mockResolvedValue(true) },
  });
  return { device, requestDevice };
}

function bluetoothRejects(error: unknown) {
  Object.defineProperty(navigator, "bluetooth", {
    configurable: true,
    value: { requestDevice: vi.fn().mockRejectedValue(error) },
  });
}

describe("readSoilSensorBluetooth", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "bluetooth");
  });

  it("asks only for BulanTanom-Soil and its UART service", async () => {
    const { requestDevice } = fakeBluetooth([LINE, LINE, LINE]);
    await readSoilSensorBluetooth();
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ name: "BulanTanom-Soil" }],
      optionalServices: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"],
    });
  });

  it("joins 20-byte notifications into a line, returns it as sent and disconnects", async () => {
    const { device } = fakeBluetooth(["boot message", LINE, LINE.replace("6.5", "7.1")]);
    await expect(readSoilSensorBluetooth()).resolves.toEqual(READING);
    expect(device.gatt.disconnect).toHaveBeenCalled();
  });

  it("says when the connection drops mid-reading", async () => {
    fakeBluetooth([LINE], { dropAfter: 2 });
    await expect(readSoilSensorBluetooth()).rejects.toMatchObject({ code: "ble_disconnected" });
  });

  it("says when the probe never answered", async () => {
    fakeBluetooth(['{"error":"no_response"}']);
    vi.useFakeTimers();
    const result = readSoilSensorBluetooth();
    const check = expect(result).rejects.toMatchObject({ code: "probe_not_answering" });
    await vi.advanceTimersByTimeAsync(25000);
    await check;
    vi.useRealTimers();
  });

  it("tells Bluetooth off, permission denied and no device apart", async () => {
    bluetoothRejects(new DOMException("Bluetooth adapter not available.", "NotFoundError"));
    await expect(readSoilSensorBluetooth()).rejects.toMatchObject({ code: "bluetooth_off" });
    bluetoothRejects(new DOMException("Bluetooth permission has been blocked.", "NotAllowedError"));
    await expect(readSoilSensorBluetooth()).rejects.toMatchObject({ code: "ble_permission_denied" });
    bluetoothRejects(new DOMException("User cancelled the requestDevice() chooser.", "NotFoundError"));
    await expect(readSoilSensorBluetooth()).rejects.toMatchObject({ code: "ble_not_found" });
  });

  it("says Bluetooth is off before opening the chooser", async () => {
    const requestDevice = vi.fn();
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: { requestDevice, getAvailability: vi.fn().mockResolvedValue(false) },
    });
    await expect(readSoilSensorBluetooth()).rejects.toMatchObject({ code: "bluetooth_off" });
    expect(requestDevice).not.toHaveBeenCalled();
  });
});
