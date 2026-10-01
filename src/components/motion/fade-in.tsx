"use client";

import { motion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
};

export function FadeIn({
  children,
  delay = 0,
  duration = 1000,
  y = 12,
  className,
}: FadeInProps) {
  // `reducedMotion="user"` drops the movement for people who ask for less
  // motion and keeps the fade. The markup is the same either way: branching
  // on the preference instead renders differently on the server and in the
  // browser, which left the content stuck invisible for those users.
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: delay / 1000,
          duration: duration / 1000,
          ease: "easeOut",
        }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
