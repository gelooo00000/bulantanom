"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ElementType } from "react";

type AnimatedHeadingProps = {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
};

export function AnimatedHeading({
  text,
  as: Component = "h1",
  className,
  delay = 200,
  stagger = 30,
  duration = 500,
}: AnimatedHeadingProps) {
  const reduceMotion = useReducedMotion();
  const lines = text.split("\n");

  if (reduceMotion) {
    return (
      <Component className={className}>
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </Component>
    );
  }

  let charIndex = 0;

  return (
    <Component className={className}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {Array.from(line).map((char) => {
            const index = charIndex++;
            return (
              <motion.span
                key={index}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: (delay + index * stagger) / 1000,
                  duration: duration / 1000,
                  ease: "easeOut",
                }}
                style={{
                  display: "inline-block",
                  whiteSpace: char === " " ? "pre" : "normal",
                }}
              >
                {char}
              </motion.span>
            );
          })}
        </span>
      ))}
    </Component>
  );
}
