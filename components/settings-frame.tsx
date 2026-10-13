"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
export function SettingsFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow mb-3">A space that feels like you</p>
      <h1 className="page-title">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
        {description}
      </p>
      <nav
        aria-label="Settings"
        className="mb-8 mt-7 flex gap-5 border-b border-[var(--line)]"
      >
        {[
          { href: "/settings/profile", label: "Your profile" },
          { href: "/settings/space", label: "Shared space" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 items-center border-b-2 px-1 text-sm",
              path === href
                ? "border-[var(--accent)] text-[var(--accent-deep)]"
                : "border-transparent text-[var(--muted)]",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-8">{children}</div>
    </div>
  );
}
