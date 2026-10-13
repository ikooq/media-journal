"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Compass,
  Home,
  LibraryBig,
  Plus,
  Search,
  LockKeyhole,
  ArrowRight,
  FolderOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { useWorkspace } from "./workspace-provider";
import { Avatar, Button, Input } from "./ui";
import { AddMediaModal } from "./add-media-modal";
import { Modal } from "./modal";
import { MediaImage } from "./media-image";
import { getLibrary, selectSpace } from "@/lib/data/client";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { MediaItem } from "@/types/domain";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/us", label: "Us", icon: Compass },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter();
  const [addOpen, setAddOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  const [authError, setAuthError] = useState("");
  const { people, currentUserId, activeSpace, spaces, loading } =
    useWorkspace();
  const currentUser = people.find((p) => p.id === currentUserId) ?? people[0];
  useEffect(() => {
    const open = () => setAddOpen(true);
    const scroll = () => setScrolled(window.scrollY > 16);
    const keyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("open-add-media", open);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("open-add-media", open);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) setAuthError("Could not sign out. Please retry.");
    else {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className={cn("journal-header", scrolled && "is-scrolled")}>
        <div className="journal-header-inner">
          <Link href="/" className="brand" aria-label="Our Shelf home">
            <span className="brand-mark">
              <BookOpen size={21} strokeWidth={1.5} />
            </span>
            <span className="brand-wordmark">
              our shelf<span className="text-[var(--accent)]">.</span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="desktop-nav">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("desktop-nav-link", active && "active")}
                >
                  {active && (
                    <m.span
                      layoutId="desktop-nav-active"
                      className="absolute inset-0 rounded-lg bg-[var(--accent-soft)]"
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="icon-button"
              aria-label="Search"
              title="Search (Ctrl / ⌘ K)"
            >
              <Search size={19} />
            </button>
            <NotificationButton />
            <Button
              onClick={() => setAddOpen(true)}
              className="hidden min-h-10 px-3.5 md:inline-flex"
              aria-label="Add media"
            >
              <Plus size={16} />
              <span className="hidden lg:inline">Add</span>
            </Button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="ml-1 flex min-h-11 items-center gap-1.5 rounded-full p-1"
            >
              <Avatar
                name={currentUser?.name ?? "Member"}
                color={currentUser?.color}
                src={currentUser?.avatar}
              />
              <ChevronDown size={13} className="hidden sm:block" />
            </button>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        aria-busy={loading}
        className="journal-main outline-none"
      >
        <div key={pathname} className="route-enter min-w-0">
          {children}
        </div>
        <footer className="journal-footer">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole size={12} aria-hidden />A little world, just yours.
          </span>
          <span className="truncate">{activeSpace?.name}</span>
        </footer>
      </main>
      <nav aria-label="Mobile navigation" className="mobile-nav">
        {navItems.slice(0, 2).map((item) => (
          <MobileNavItem key={item.href} item={item} pathname={pathname} />
        ))}
        <button
          onClick={() => setAddOpen(true)}
          className="mobile-add"
          aria-label="Add media"
        >
          <Plus size={23} />
          <span>Save</span>
        </button>
        {navItems.slice(2).map((item) => (
          <MobileNavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      {menuOpen && (
        <Modal title="Your account" onClose={() => setMenuOpen(false)}>
          <div className="flex items-center gap-3 border-b border-[var(--line)] pb-6">
            <Avatar
              name={currentUser?.name ?? "Member"}
              color={currentUser?.color}
              src={currentUser?.avatar}
              size="lg"
            />
            <div>
              <p className="text-lg font-medium">{currentUser?.name}</p>
              <p className="text-sm text-[var(--muted)]">{activeSpace?.name}</p>
            </div>
          </div>
          <div className="my-4 grid gap-1">
            {[
              {
                href: "/settings/profile",
                label: "Profile settings",
                icon: Settings,
              },
              { href: "/settings/space", label: "Space settings", icon: Home },
              { href: "/collections", label: "Collections", icon: FolderOpen },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm hover:bg-[var(--surface-soft)]"
              >
                <Icon size={17} className="text-[var(--muted)]" />
                {label}
                <ArrowRight size={15} className="ml-auto text-[var(--muted)]" />
              </Link>
            ))}
          </div>
          {spaces.length > 1 && (
            <label className="field-label mb-6">
              Active space
              <select
                value={activeSpace?.id ?? ""}
                className="form-select"
                onChange={async (e) => {
                  const r = await selectSpace(e.target.value);
                  if (r.ok) {
                    setMenuOpen(false);
                    router.refresh();
                  } else setAuthError(r.error);
                }}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-[var(--destructive)]"
            onClick={() => void signOut()}
          >
            <LogOut size={17} />
            Sign out
          </Button>
          {authError && (
            <p role="alert" className="error-message mt-4">
              {authError}
            </p>
          )}
        </Modal>
      )}
      {addOpen && <AddMediaModal onClose={() => setAddOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
function MobileNavItem({
  item,
  pathname,
}: {
  item: (typeof navItems)[number];
  pathname: string;
}) {
  const Icon = item.icon;
  const active =
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("mobile-nav-link", active && "active")}
    >
      <Icon size={21} strokeWidth={active ? 2 : 1.6} />
      <span>{item.label}</span>
    </Link>
  );
}
function NotificationButton() {
  const [open, setOpen] = useState(false);
  const { unread, notifications, markRead } = useWorkspace();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="icon-button relative"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        )}
      </button>
      {open && (
        <Modal title="Notifications" onClose={() => setOpen(false)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {unread
                ? `${unread} unread ${unread === 1 ? "update" : "updates"}`
                : "All up to date"}
            </p>
            <button onClick={() => void markRead()} className="text-link">
              Read all
            </button>
          </div>
          {notifications.length ? (
            <div className="divide-y divide-[var(--line)]">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.mediaId ? `/library/${n.mediaId}` : "/"}
                  onClick={() => {
                    void markRead(n.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "block rounded-xl p-4 transition hover:bg-[var(--surface-soft)]",
                    !n.read && "bg-[var(--accent-soft)]",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.read && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    )}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                    {n.text}
                  </span>
                  <span className="mt-2 block text-xs text-[var(--muted)]">
                    {formatRelativeDate(n.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Bell
                size={24}
                strokeWidth={1.5}
                className="text-[var(--accent)]"
              />
              <p className="section-title">You&apos;re all caught up.</p>
              <p className="text-sm text-[var(--muted)]">
                Your shared moments will find you here.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState(""),
    [items, setItems] = useState<MediaItem[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      if (!term.trim()) {
        setItems([]);
        setBusy(false);
        return;
      }
      setBusy(true);
      const r = await getLibrary({ query: term, limit: 24 });
      if (alive) {
        if (r.ok) {
          setItems(r.data.items);
          setError("");
        } else setError(r.error);
        setBusy(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [term]);
  return (
    <Modal title="Search your shelf" onClose={onClose}>
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-4 text-[var(--muted)]"
          aria-hidden
        />
        <Input
          autoFocus
          aria-label="Search the journal"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="pl-11"
          placeholder="Titles, tags, authors, and reflections…"
        />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Search the things you kept, and the thoughts they left behind.
      </p>
      {busy && (
        <p role="status" className="mt-5 text-sm text-[var(--muted)]">
          Searching your journal…
        </p>
      )}
      {error && (
        <p role="alert" className="error-message mt-5">
          {error}
        </p>
      )}
      <div className="mt-5 space-y-1">
        {items.map((i) => (
          <Link
            key={i.id}
            href={`/library/${i.id}`}
            onClick={onClose}
            className="media-row"
          >
            <MediaImage
              src={i.thumbnailUrl}
              className="media-row-art"
              width={224}
              height={152}
            />
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-medium">
                {i.title}
              </span>
              <span className="mt-1 block text-xs capitalize text-[var(--muted)]">
                {i.type}
                {i.channelName ? ` · ${i.channelName}` : ""}
              </span>
            </span>
            <ArrowRight
              size={16}
              className="ml-auto shrink-0 text-[var(--muted)]"
            />
          </Link>
        ))}
        {term && !busy && !items.length && !error && (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            No results for “{term}”. Try another word.
          </p>
        )}
      </div>
    </Modal>
  );
}
