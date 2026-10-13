"use client";
import Link from "next/link";
import { ArrowRight, Bookmark, Check } from "lucide-react";
import {
  animate,
  m,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from "motion/react";
import { useEffect, useRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import type { Person } from "@/types/domain";

export function SectionHeader({
  title,
  eyebrow,
  href,
  action = "View all",
}: {
  title: string;
  eyebrow?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-link shrink-0">
          {action}
          <ArrowRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}
export function AvatarStack({
  people,
  size = "sm",
}: {
  people: Person[];
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className="inline-flex -space-x-2">
      {people.map((p) => (
        <Avatar
          key={p.id}
          name={p.name}
          src={p.avatar}
          color={p.color}
          size={size}
        />
      ))}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Bookmark size={21} strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="section-title max-w-md">{title}</h2>
      {description && (
        <p className="max-w-sm text-sm leading-7 text-[var(--muted)]">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
export function StatNumber({
  value,
  suffix = "",
  label,
}: {
  value: number;
  suffix?: string;
  label: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || previous.current === value) return;
    const animation = animate(previous.current, value, {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        if (ref.current)
          ref.current.textContent = Math.round(n).toLocaleString();
      },
    });
    previous.current = value;
    return () => animation.stop();
  }, [value, reduced]);
  return (
    <div>
      <p className="stat-number">
        <span className="sr-only">{`${value} ${label}`}</span>
        <span ref={ref} aria-hidden>
          {value.toLocaleString()}
        </span>
        <span className="ml-1 text-xl" aria-hidden>
          {suffix}
        </span>
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}
export function TiltSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 260, damping: 28 }),
    rotateY = useSpring(y, { stiffness: 260, damping: 28 });
  return (
    <m.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        if (
          reduced ||
          e.pointerType !== "mouse" ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const bounds = e.currentTarget.getBoundingClientRect();
        x.set((0.5 - (e.clientY - bounds.top) / bounds.height) * 5);
        y.set(((e.clientX - bounds.left) / bounds.width - 0.5) * 5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </m.div>
  );
}
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <fieldset>
      <legend className="field-label mb-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className="segmented">
        {options.map((option, index) => (
          <button
            type="button"
            role="radio"
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            className="segment"
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (
                ![
                  "ArrowRight",
                  "ArrowLeft",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                  "End",
                ].includes(e.key)
              )
                return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (index +
                        (["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : -1) +
                        options.length) %
                      options.length;
              onChange(options[next].value);
              buttons.current[next]?.focus();
            }}
          >
            {value === option.value && (
              <m.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-[7px] bg-[var(--surface)] shadow-sm"
                transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function MediaSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading your media" className="media-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden>
          <div className="skeleton aspect-[16/10]" />
          <div className="skeleton mt-4 h-4 w-3/4" />
          <div className="skeleton mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
export function PageSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <div
      role="status"
      aria-label={detail ? "Loading media" : "Loading your shelf"}
      className="space-y-8"
    >
      <div
        className={cn(
          "skeleton",
          detail ? "h-80 md:h-[420px]" : "h-12 w-2/3 max-w-md",
        )}
      />
      {detail ? (
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="skeleton h-64" />
          <div className="skeleton h-64" />
        </div>
      ) : (
        <MediaSkeleton />
      )}
    </div>
  );
}
export function SavedMark() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success)]">
      <Check size={14} aria-hidden />
      Saved privately
    </span>
  );
}
