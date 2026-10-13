"use client";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { MediaImage } from "./media-image";
import { avatarForeground } from "@/lib/ui-utils";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
  }
>(function Button({ className, variant = "primary", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn("button", `button-${variant}`, className)}
      {...props}
    />
  );
});
export function Card({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "quiet" }) {
  return (
    <div
      className={cn("card", variant === "quiet" && "card-quiet", className)}
      {...props}
    />
  );
}
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      data-autofocus={props.autoFocus || undefined}
      className={cn("input", className)}
      {...props}
    />
  );
});
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "peach" | "gold";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Avatar({
  name,
  color,
  src,
  size = "md",
}: {
  name: string;
  color?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--page)] font-semibold text-white",
        size === "sm" && "h-7 w-7 text-[10px]",
        size === "md" && "h-9 w-9 text-xs",
        size === "lg" && "h-16 w-16 text-lg",
      )}
      style={{
        backgroundColor: color ?? "var(--accent)",
        color: avatarForeground(color ?? "#425b49"),
      }}
    >
      {src ? (
        <MediaImage
          src={src}
          className="h-full w-full object-cover"
          width={128}
          height={128}
        />
      ) : (
        initials
      )}
    </span>
  );
}
export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label="Viewing progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn(
        "h-1 overflow-hidden rounded-full bg-[var(--line)]",
        className,
      )}
    >
      <m.div
        initial={false}
        animate={{ scaleX: percent / 100 }}
        className="h-full origin-left rounded-full bg-[var(--accent)]"
        transition={{ duration: 0.45 }}
      />
    </div>
  );
}
