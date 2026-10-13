"use client";
import { LazyMotion, MotionConfig, LayoutGroup } from "motion/react";
const features = () =>
  import("./motion-features").then((module) => module.default);
export function JournalMotion({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        <LayoutGroup id="journal">{children}</LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
