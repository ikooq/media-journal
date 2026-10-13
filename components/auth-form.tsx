"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ArrowRight } from "lucide-react";
import { Button, Input } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth";
import { ConfigurationRequired } from "./configuration-required";
type Mode = "login" | "signup" | "forgot-password" | "reset-password";
const copy = {
  login: [
    "Welcome back",
    "Come on in.",
    "Your little archive is waiting right where you left it.",
    "Sign in",
  ],
  signup: [
    "Start your archive",
    "Make room for good things.",
    "Create your account, then make a space of your own.",
    "Create my shelf",
  ],
  "forgot-password": [
    "Account recovery",
    "Find your way back.",
    "We’ll send a secure reset link to your email.",
    "Send reset link",
  ],
  "reset-password": [
    "New password",
    "A fresh start.",
    "Choose a new password with at least 8 characters.",
    "Update password",
  ],
};
export function AuthForm({ mode }: { mode: Mode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const [query, setQuery] = useState("");
  useEffect(() => {
    setQuery(window.location.search);
    if (new URLSearchParams(window.location.search).get("error"))
      setError(
        "This confirmation link is invalid or expired. Please request another link.",
      );
  }, []);
  const c = copy[mode];
  if (!isConfigured()) return <ConfigurationRequired />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const db = createClient();
      const next = safeNext(
        new URLSearchParams(window.location.search).get("next"),
      );
      let authError;
      if (mode === "login") {
        const r = await db.auth.signInWithPassword({ email, password });
        authError = r.error;
        if (!authError) {
          router.replace(next);
          router.refresh();
        }
      }
      if (mode === "signup") {
        const r = await db.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        authError = r.error;
        if (!authError) {
          if (r.data.session) {
            router.replace(next);
            router.refresh();
          } else setMessage("Check your inbox to confirm your account.");
        }
      }
      if (mode === "forgot-password") {
        const r = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        authError = r.error;
        if (!authError)
          setMessage(
            "If that email has an account, a reset link is on its way.",
          );
      }
      if (mode === "reset-password") {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user)
          throw new Error("Open the reset link from your email first.");
        const r = await db.auth.updateUser({ password });
        authError = r.error;
        if (!authError) {
          setMessage("Password updated. You can return to your shelf.");
          setPassword("");
        }
      }
      if (authError) throw new Error(authError.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <aside className="auth-editorial">
        <Link href="/" className="brand" aria-label="Our Shelf home">
          <span className="brand-mark">
            <BookOpen size={21} strokeWidth={1.5} />
          </span>
          <span className="brand-wordmark">our shelf.</span>
        </Link>
        <div className="auth-story">
          <p className="eyebrow">A journal for the two of you</p>
          <h2>
            Good things.
            <br />
            <em>Kept together.</em>
          </h2>
          <p>
            The films you talk about.
            <br />
            The ideas you carry with you.
            <br />
            The little things that become yours.
          </p>
        </div>
        <div className="auth-book-art" aria-hidden>
          <span className="auth-book book-back" />
          <span className="auth-book book-front">
            <span>
              our
              <br />
              little
              <br />
              world.
            </span>
          </span>
        </div>
        <p className="auth-editorial-footer">
          For what you discover. And what stays.
        </p>
      </aside>
      <section className="auth-panel">
        <div className="auth-form">
          <p className="eyebrow">{c[0]}</p>
          <h1 className="page-title mt-4 !text-[clamp(2.2rem,4vw,3rem)]">
            {c[1]}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{c[2]}</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === "signup" && (
              <label className="field-label">
                Your name
                <Input
                  required
                  autoComplete="name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            {mode !== "reset-password" && (
              <label className="field-label">
                Email
                <Input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {mode !== "forgot-password" && (
              <label className="field-label">
                Password
                <Input
                  required
                  type="password"
                  minLength={mode === "login" ? 1 : 8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <Button disabled={busy} className="w-full !min-h-12">
              {busy ? "Please wait…" : c[3]}
              <ArrowRight size={16} />
            </Button>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-xl bg-[var(--accent-soft)] p-4 text-sm leading-7 text-[var(--accent-deep)]"
              >
                {message}
              </p>
            )}
          </form>
          <div className="mt-7 space-y-3 text-sm text-[var(--muted)]">
            {mode === "login" ? (
              <>
                <p>
                  <Link href="/forgot-password" className="text-link">
                    Forgot password?
                  </Link>
                </p>
                <p className="border-t border-[var(--line)] pt-5">
                  A new beginning?{" "}
                  <Link href={`/signup${query}`} className="text-link ml-1">
                    Create an account
                    <ArrowRight size={14} />
                  </Link>
                </p>
              </>
            ) : (
              <Link
                href={mode === "reset-password" ? "/" : "/login"}
                className="text-link"
              >
                {mode === "reset-password"
                  ? "Open your shelf"
                  : "Back to sign in"}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <p className="mt-10 text-xs leading-6 text-[var(--muted)]">
            A private home for shared discoveries.
          </p>
        </div>
      </section>
    </main>
  );
}
