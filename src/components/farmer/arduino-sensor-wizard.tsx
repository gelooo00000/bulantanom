"use client";

import {
  ArrowLeft,
  ArrowRight,
  Cable,
  Cpu,
  LoaderCircle,
  RotateCw,
  Sprout,
  Usb,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  isSerialSupported,
  readSoilSensor,
  SensorError,
  toFormValues,
  type MeasuredField,
  type SensorReadings,
} from "@/lib/arduino/soil-sensor";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { SENSOR_FIELDS, sensorLabel } from "@/lib/soil-options";

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
type ReadState =
  | { kind: "ready" }
  | { kind: "reading" }
  | { kind: "done"; readings: SensorReadings }
  | { kind: "error"; message: string; received?: string };

/**
 * Three pages: what the sensor does, how to use it, then Go. Go reads the
 * probe over USB and shows the readings; "Use these readings" hands them to
 * the form, which carries on to the recommendation.
 *
 * `afterReadings` is shown under the readings once they are in - the form
 * passes its Additional Soil Information box.
 */
export function ArduinoSensorWizard({
  onReadings,
  onCancel,
  afterReadings,
}: {
  onReadings: (values: Record<MeasuredField, string>) => void;
  onCancel: () => void;
  afterReadings?: ReactNode;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  // Which way the pages slide: forward from the right, back from the left.
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState<ReadState>({ kind: "ready" });
  const supported = isSerialSupported();

  function goTo(next: Step) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function read() {
    setState({ kind: "reading" });
    try {
      setState({ kind: "done", readings: await readSoilSensor() });
    } catch (err) {
      const code = err instanceof SensorError ? err.code : "disconnected";
      setState({
        kind: "error",
        message: t(`arduino.error.${code}` as MessageKey),
        received: err instanceof SensorError ? err.received : undefined,
      });
    }
  }

  const steps = [
    { icon: Sprout, text: t("arduino.how1") },
    { icon: Cable, text: t("arduino.how2") },
    { icon: Usb, text: t("arduino.how3") },
    { icon: LoaderCircle, text: t("arduino.how4") },
  ];

  let page;
  if (step === 1) {
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
        <h2 className="font-heading text-lg font-semibold">
          {state.kind === "done" ? t("arduino.resultTitle") : t("arduino.goTitle")}
        </h2>

        {!supported ? (
          <p className="text-risk-high text-sm" role="alert">
            {t("arduino.unsupported")}
          </p>
        ) : state.kind === "done" ? (
          <>
            <dl className="grid gap-2 sm:grid-cols-2">
              {SENSOR_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="border-border flex items-baseline justify-between rounded-md border px-3 py-2"
                >
                  <dt className="text-muted-foreground text-xs">{sensorLabel(field, t)}</dt>
                  <dd className="text-sm font-medium">
                    {toFormValues(state.readings)[field.key]} {field.unit}
                  </dd>
                </div>
              ))}
            </dl>
            {afterReadings}
          </>
        ) : state.kind === "reading" ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <LoaderCircle className="text-primary size-4 animate-spin" />
            {t("arduino.reading")}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{t("arduino.goBody")}</p>
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
          <p className="text-muted-foreground text-xs font-medium">
            {t("arduino.stepOf", { step })}
          </p>
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={
                  dot <= step ? "bg-primary h-1.5 w-6 rounded-full" : "bg-muted h-1.5 w-6 rounded-full"
                }
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
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
          {step === 1 ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("arduino.typeInstead")}
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

          {step < 3 ? (
            <Button type="button" onClick={() => goTo((step + 1) as Step)}>
              {t("arduino.next")}
              <ArrowRight className="size-4" />
            </Button>
          ) : !supported ? (
            <Button type="button" onClick={onCancel}>
              {t("arduino.typeInstead")}
            </Button>
          ) : state.kind === "done" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={read}>
                <RotateCw className="size-4" />
                {t("arduino.readAgain")}
              </Button>
              <Button type="button" onClick={() => onReadings(toFormValues(state.readings))}>
                {t("arduino.useReadings")}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <Button type="button" size="lg" onClick={read} disabled={state.kind === "reading"}>
              {state.kind === "reading" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Usb className="size-4" />
              )}
              {t("arduino.go")}
            </Button>
          )}
        </div>
      </section>
    </MotionConfig>
  );
}
