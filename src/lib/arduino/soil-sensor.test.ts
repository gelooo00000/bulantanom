import { afterEach, describe, expect, it, vi } from "vitest";

import {
  averageReadings,
  parseSensorLine,
  readSoilSensor,
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

describe("averageReadings", () => {
  it("averages the polls and keeps each reading's resolution", () => {
    const result = averageReadings([
      READING,
      { ...READING, soil_moisture: 65.3, nitrogen: 121 },
      { ...READING, soil_moisture: 65.4, nitrogen: 121 },
    ]);
    expect(result.soil_moisture).toBe(65.3);
    expect(result.nitrogen).toBe(121);
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
  it("averages three readings and closes the port", async () => {
    const port = fakePort(["boot message", LINE, LINE, LINE]);
    await expect(readSoilSensor()).resolves.toEqual(READING);
    expect(port.close).toHaveBeenCalled();
  });

  it("says when the probe never answered", async () => {
    fakePort(['{"error":"no_response"}', '{"error":"no_response"}']);
    await expect(readSoilSensor()).rejects.toMatchObject({ code: "probe_not_answering" });
  });

  it("says when the browser has no Web Serial", async () => {
    await expect(readSoilSensor()).rejects.toBeInstanceOf(SensorError);
    await expect(readSoilSensor()).rejects.toMatchObject({ code: "unsupported" });
  });
});
