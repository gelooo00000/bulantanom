"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bluetooth,
  Cable,
  Cpu,
  Download,
  Laptop,
  LoaderCircle,
  Power,
  SlidersHorizontal,
  Smartphone,
  Sprout,
  TriangleAlert,
  Usb,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  isBluetoothSupported,
  isSerialSupported,
  readSoilSensor,
  readSoilSensorBluetooth,
  SensorError,
  toFormValues,
  type MeasuredField,
} from "@/lib/arduino/soil-sensor";
import { useLanguage, type MessageKey } from "@/lib/i18n";

/** The sign above the form: the feature works with the Arduino sensor. */
export function ArduinoSensorSign({ onStart }: { onStart: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="border-primary/30 bg-primary/5 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Cpu className="size-4" />
        </span>
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className="self-start">
            {t("arduino.badge")}
          </Badge>
          <p className="text-sm font-medium">{t("arduino.signTitle")}</p>
          <p className="text-muted-foreground text-xs">{t("arduino.signBody")}</p>
        </div>
      </div>
      <Button type="button" variant="outline" className="shrink-0" onClick={onStart}>
        <Usb className="size-4" />
        {t("arduino.useSensor")}
      </Button>
    </div>
  );
}

type Step = 1 | 2 | 3;
/** How the browser reaches the sensor: the USB cable, or Bluetooth. */
type Method = "usb" | "bluetooth";
/** What the farmer reads with: a laptop (USB cable) or a phone (Bluetooth). */
type Device = "laptop" | "phone";
type ReadState =
  | { kind: "ready" }
  | { kind: "reading" }
  | { kind: "error"; message: string; received?: string };

/**
 * First the farmer picks a laptop or a phone (iPhones cannot connect, so a
 * warning says so). Then three pages: what the sensor does, how to use it on
 * that device, then Connect. It reads the probe over USB on a laptop, or
 * over Bluetooth on a phone, and hands the readings straight to the form,
 * which fills its text fields with them.
 */
export function ArduinoSensorWizard({
  onReadings,
  onCancel,
}: {
  onReadings: (values: Record<MeasuredField, string>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [device, setDevice] = useState<Device | null>(null);
  const [step, setStep] = useState<Step>(1);
  // Which way the pages slide: forward from the right, back from the left.
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState<ReadState>({ kind: "ready" });
  const usbSupported = isSerialSupported();
  const bluetoothSupported = isBluetoothSupported();
  const onPhone = device === "phone";
  // A phone reads only by Bluetooth, a laptop only by the USB cable.
  const supported = onPhone ? bluetoothSupported : usbSupported;

  function goTo(next: Step) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function chooseDevice(next: Device) {
    setDirection(1);
    setDevice(next);
    setStep(1);
    setState({ kind: "ready" });
  }

  function backToDevices() {
    setDirection(-1);
    setDevice(null);
  }

  async function read(how: Method) {
    setState({ kind: "reading" });
    try {
      const readings = toFormValues(
        await (how === "bluetooth" ? readSoilSensorBluetooth() : readSoilSensor()),
      );
      setState({ kind: "ready" });
      onReadings(readings as Record<MeasuredField, string>);
    } catch (err) {
      const code =
        err instanceof SensorError ? err.code : how === "bluetooth" ? "ble_disconnected" : "disconnected";
      setState({
        kind: "error",
        message: t(`arduino.error.${code}` as MessageKey),
        received: err instanceof SensorError ? err.received : undefined,
      });
    }
  }

  const steps = onPhone
    ? [
        { icon: Download, text: t("arduino.phoneApp") },
        { icon: SlidersHorizontal, text: t("arduino.phoneBaud") },
        { icon: Smartphone, text: t("arduino.phoneHow1") },
        { icon: Sprout, text: t("arduino.how1") },
        { icon: Power, text: t("arduino.phoneHow2") },
        { icon: Bluetooth, text: t("arduino.how3Bluetooth") },
        { icon: LoaderCircle, text: t("arduino.how4") },
      ]
    : [
        { icon: Sprout, text: t("arduino.how1") },
        { icon: Cable, text: t("arduino.how2") },
        { icon: Usb, text: t("arduino.how3") },
        { icon: LoaderCircle, text: t("arduino.how4") },
      ];

  const devices = [
    {
      value: "laptop" as const,
      icon: Laptop,
      label: t("arduino.deviceLaptop"),
      hint: t("arduino.deviceLaptopHint"),
    },
    {
      value: "phone" as const,
      icon: Smartphone,
      label: t("arduino.devicePhone"),
      hint: t("arduino.devicePhoneHint"),
    },
  ];

  let page;
  if (device === null) {
    page = (
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t("arduino.deviceTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("arduino.deviceBody")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map(({ value, icon: Icon, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseDevice(value)}
              className="border-border hover:border-primary hover:bg-primary/5 focus-visible:ring-ring flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-muted-foreground text-xs">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div
          className="border-risk-high/40 bg-risk-high/5 flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
          role="note"
        >
          <TriangleAlert className="text-risk-high mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{t("arduino.iphoneWarningTitle")}</span>{" "}
            {t("arduino.iphoneWarning")}
          </p>
        </div>
      </div>
    );
  } else if (step === 1) {
    page = (
      <div className="flex flex-col gap-3">
        <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
          <Cpu className="size-6" />
        </span>
        <h2 className="font-heading text-lg font-semibold">{t("arduino.signTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("arduino.introBody")}</p>
      </div>
    );
  } else if (step === 2) {
    page = (
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t("arduino.howTitle")}</h2>
        <ol className="flex flex-col gap-2.5">
          {steps.map(({ icon: Icon, text }, index) => (
            <motion.li
              key={text}
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 * index, duration: 0.3 }}
            >
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              <span className="flex items-start gap-2 text-sm">
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                {text}
              </span>
            </motion.li>
          ))}
        </ol>
      </div>
    );
  } else {
    page = (
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t("arduino.goTitle")}</h2>

        {!supported ? (
          <p className="text-risk-high text-sm" role="alert">
            {onPhone ? t("arduino.unsupportedPhone") : t("arduino.unsupported")}
          </p>
        ) : state.kind === "reading" ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <LoaderCircle className="text-primary size-4 animate-spin" />
            {t("arduino.reading")}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {onPhone ? t("arduino.goBodyBluetooth") : t("arduino.goBody")}
            </p>
            {state.kind === "error" && (
              <div className="flex flex-col gap-1.5" role="alert">
                <p className="text-risk-high text-sm">{state.message}</p>
                {state.received ? (
                  <p className="text-muted-foreground text-xs">
                    {t("arduino.received")}{" "}
                    <code className="bg-muted rounded px-1.5 py-0.5 break-all">
                      {state.received}
                    </code>
                  </p>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-label={t("arduino.useSensor")}
        className="border-border flex flex-col gap-5 overflow-hidden rounded-lg border p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            {device === null ? (
              t("arduino.deviceStep")
            ) : (
              <>
                {onPhone ? <Smartphone className="size-3.5" /> : <Laptop className="size-3.5" />}
                {t("arduino.stepOf", { step })}
              </>
            )}
          </p>
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={
                  device !== null && dot <= step ? "bg-primary h-1.5 w-6 rounded-full" : "bg-muted h-1.5 w-6 rounded-full"
                }
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={device === null ? "device" : `${device}-${step}`}
            custom={direction}
            initial={{ opacity: 0, x: 40 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * direction }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {page}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {device === null ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("arduino.typeInstead")}
            </Button>
          ) : step === 1 ? (
            <Button type="button" variant="ghost" onClick={backToDevices}>
              <ArrowLeft className="size-4" />
              {t("arduino.back")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => goTo((step - 1) as Step)}
              disabled={state.kind === "reading"}
            >
              <ArrowLeft className="size-4" />
              {t("arduino.back")}
            </Button>
          )}

          {device === null ? null : step < 3 ? (
            <Button type="button" onClick={() => goTo((step + 1) as Step)}>
              {t("arduino.next")}
              <ArrowRight className="size-4" />
            </Button>
          ) : !supported ? (
            <Button type="button" onClick={onCancel}>
              {t("arduino.typeInstead")}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {onPhone ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => read("bluetooth")}
                  disabled={state.kind === "reading"}
                >
                  {state.kind === "reading" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Bluetooth className="size-4" />
                  )}
                  {t("arduino.goBluetooth")}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => read("usb")}
                  disabled={state.kind === "reading"}
                >
                  {state.kind === "reading" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Usb className="size-4" />
                  )}
                  {t("arduino.goUsb")}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </MotionConfig>
  );
}
