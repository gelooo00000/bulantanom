/**
 * Reads the farm's Arduino soil sensor over a USB cable.
 *
 * The ESP32 (firmware in `hardware/soil-sensor/`) polls a 7-in-1 RS485 soil
 * probe and prints one JSON line every two seconds:
 *
 *   {"moisture":65.2,"temperature":28.5,"ec":850,"ph":6.5,"n":120,"p":80,"k":150}
 *
 * or `{"error":"no_response"}` when the probe does not answer. The browser
 * reads those lines with the Web Serial API, which Chrome and Edge offer on
 * computers. Safari and iPhones have no Web Serial at all.
 *
 * The probe measures all seven of the form's readings.
 */

import type { SensorField } from "@/lib/soil-options";

/** The form fields the probe fills in: every one of them. */
export type MeasuredField = SensorField["key"];

export type SensorReadings = Record<MeasuredField, number>;

/** Firmware JSON key -> form field. */
const FIRMWARE_KEYS: Record<string, MeasuredField> = {
  moisture: "soil_moisture",
  temperature: "soil_temperature",
  ec: "soil_conductivity",
  ph: "soil_ph",
  n: "nitrogen",
  p: "phosphorus",
  k: "potassium",
};

/** Decimal places each reading keeps, matching the probe's own resolution. */
const DECIMALS: Record<MeasuredField, number> = {
  soil_moisture: 1,
  soil_temperature: 1,
  soil_conductivity: 0,
  soil_ph: 1,
  nitrogen: 0,
  phosphorus: 0,
  potassium: 0,
};

export const MEASURED_FIELDS = Object.values(FIRMWARE_KEYS);

/** Readings averaged into one result, so a single noisy poll cannot decide it. */
export const SAMPLES_PER_READING = 3;
const SERIAL_BAUD = 115200;
const READ_TIMEOUT_MS = 20000;

export type SensorErrorCode =
  | "unsupported"
  | "cancelled"
  | "busy"
  | "no_data"
  | "unrecognized"
  | "probe_not_answering"
  | "disconnected";

export class SensorError extends Error {
  /** For "unrecognized": the last line the Arduino sent, to show the farmer. */
  constructor(
    public code: SensorErrorCode,
    public received?: string,
  ) {
    super(code);
  }
}

/** Longest stretch of a received line shown back to the farmer. */
const RECEIVED_PREVIEW = 120;

export type ParsedLine =
  | { kind: "reading"; readings: SensorReadings }
  | { kind: "probe_error" }
  | { kind: "ignored" };

/**
 * One line from the ESP32. Anything that is not the firmware's JSON (its boot
 * messages, for one) is ignored rather than treated as a failure.
 */
export function parseSensorLine(line: string): ParsedLine {
  const text = line.trim();
  if (!text.startsWith("{")) return { kind: "ignored" };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: "ignored" };
  }
  if (!data || typeof data !== "object") return { kind: "ignored" };
  const record = data as Record<string, unknown>;
  if ("error" in record) return { kind: "probe_error" };

  const readings = {} as SensorReadings;
  for (const [key, field] of Object.entries(FIRMWARE_KEYS)) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return { kind: "ignored" };
    readings[field] = value;
  }
  return { kind: "reading", readings };
}

/** The mean of several polls, rounded to each reading's resolution. */
export function averageReadings(samples: SensorReadings[]): SensorReadings {
  const result = {} as SensorReadings;
  for (const field of MEASURED_FIELDS) {
    const mean = samples.reduce((sum, sample) => sum + sample[field], 0) / samples.length;
    const factor = 10 ** DECIMALS[field];
    result[field] = Math.round(mean * factor) / factor;
  }
  return result;
}

/** The readings as the text the form's inputs hold. */
export function toFormValues(readings: SensorReadings): Record<MeasuredField, string> {
  return Object.fromEntries(
    MEASURED_FIELDS.map((field) => [field, readings[field].toFixed(DECIMALS[field])]),
  ) as Record<MeasuredField, string>;
}

// The parts of Web Serial used here. TypeScript's DOM library does not
// describe it yet.
type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};
type SerialLike = { requestPort(): Promise<SerialPortLike> };

function serialApi(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { serial?: SerialLike }).serial ?? null;
}

export function isSerialSupported(): boolean {
  return serialApi() !== null;
}

/**
 * Asks the farmer to pick the ESP32's port, then returns the average of the
 * first SAMPLES_PER_READING readings. The port is closed again before this
 * returns, whatever happens.
 */
export async function readSoilSensor(): Promise<SensorReadings> {
  const serial = serialApi();
  if (!serial) throw new SensorError("unsupported");

  let port: SerialPortLike;
  try {
    port = await serial.requestPort();
  } catch {
    // Closing the browser's port picker rejects the request.
    throw new SensorError("cancelled");
  }

  try {
    await port.open({ baudRate: SERIAL_BAUD });
  } catch {
    // Most often the Arduino IDE's serial monitor still holds the port.
    throw new SensorError("busy");
  }

  const reader = port.readable?.getReader();
  if (!reader) {
    await port.close().catch(() => {});
    throw new SensorError("disconnected");
  }

  const timer = setTimeout(() => {
    reader.cancel().catch(() => {});
  }, READ_TIMEOUT_MS);
  const decoder = new TextDecoder();
  const samples: SensorReadings[] = [];
  let probeErrors = 0;
  // The last line that was not a reading: a sketch other than BulanTanom's,
  // or the ESP32's own boot messages, tell the farmer what is wrong.
  let lastIgnored = "";
  let buffer = "";

  try {
    while (samples.length < SAMPLES_PER_READING) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw new SensorError("disconnected");
      }
      if (chunk.done) {
        if (probeErrors > 0) throw new SensorError("probe_not_answering");
        const tail = (lastIgnored || buffer).trim();
        if (tail) throw new SensorError("unrecognized", tail.slice(0, RECEIVED_PREVIEW));
        throw new SensorError("no_data");
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parseSensorLine(line);
        if (parsed.kind === "reading") samples.push(parsed.readings);
        if (parsed.kind === "probe_error") probeErrors += 1;
        if (parsed.kind === "ignored" && line.trim()) lastIgnored = line.trim();
      }
    }
    return averageReadings(samples.slice(0, SAMPLES_PER_READING));
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
    await port.close().catch(() => {});
  }
}
