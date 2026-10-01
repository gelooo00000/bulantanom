"use client";

import { motion, MotionConfig } from "motion/react";
import type { ElementType } from "react";

import { cn } from "@/lib/utils";

type AnimatedHeadingProps = {
  text: string;
  as?: ElementType;
  className?: string;
  /** Extra classes per line, by line index (e.g. a colour for one line). */
  lineClassNames?: string[];
  delay?: number;
  stagger?: number;
  duration?: number;
};

export function AnimatedHeading({
  text,
  as: Component = "h1",
  className,
  lineClassNames,
  delay = 200,
  stagger = 30,
  duration = 500,
}: AnimatedHeadingProps) {
  const lines = text.split("\n");

  let charIndex = 0;

  // Same markup for everyone; `reducedMotion="user"` keeps the fade and drops
  // the slide for people who ask for less motion (see FadeIn).
  return (
    <MotionConfig reducedMotion="user">
      <Component className={className}>
        {lines.map((line, lineIndex) => (
          <span
            key={lineIndex}
            className={cn("block", lineClassNames?.[lineIndex])}
          >
            {/* Each word is kept whole, so a narrow screen wraps between words
              rather than between two animated letters. */}
            {line.split(/(\s+)/).map((word, wordIndex) => (
              <span key={wordIndex} className="inline-block whitespace-nowrap">
                {Array.from(word).map((char) => {
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
          </span>
        ))}
      </Component>
    </MotionConfig>
  );
}
