"use client";

import * as React from "react";
import Link from "next/link";
import {
  LogOut,
  Menu,
  Search,
  Bell,
  Check,
  CheckCheck,
  Clock,
  ShieldAlert,
  FileText,
  X,
  ExternalLink,
  ArrowRight,
  UserCheck,
  Sparkles,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  getAuthUser,
  setAuthUser as saveAuthUser,
  clearAuthToken,
  authHeaders,
} from "@/lib/auth-token";

interface TopNavProps {
  className?: string;
  onMenuClick?: () => void;
  teacher?: {
    name: string;
    email?: string;
  };
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: "alert" | "submission" | "info";
  href: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Proctoring Flag Detected",
    description: "Tab switch and devtools flagged in active exam session.",
    time: "5m ago",
    read: false,
    type: "alert",
    href: "/dashboard/live",
  },
  {
    id: "n2",
    title: "New Exam Submission",
    description: "Candidate submitted Computer Networks & Security midterm.",
    time: "20m ago",
    read: false,
    type: "submission",
    href: "/dashboard/results",
  },
];

const DEFAULT_TEACHER = {
  name: "Dr. Elena Carter",
  email: "elena.carter@school.edu",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopNav({ className, onMenuClick, teacher }: TopNavProps) {
  const [authUser, setAuthUser] = React.useState<{ name: string; email?: string } | null>(null);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [notifOpen, setNotifOpen] = React.useState<boolean>(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    const user = getAuthUser();
    if (user) {
      setAuthUser(user);
    }
    async function verifyAuth() {
      const headers = authHeaders();
      if (!headers.Authorization) return;
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          headers,
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload.data?.user) {
            saveAuthUser(payload.data.user);
            setAuthUser(payload.data.user);
          }
        }
      } catch {
        // Keep existing user state
      }
    }
    void verifyAuth();
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click-outside listener for dropdowns
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast({
      title: "All marked as read",
      description: "Notifications updated.",
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    setNotifOpen(false);
    toast({
      title: "Notifications cleared",
      description: "Inbox emptied.",
    });
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setNotifOpen(false);
    router.push(item.href);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    router.push(`/dashboard?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const t = teacher ?? authUser ?? DEFAULT_TEACHER;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => void 0);
    } finally {
      clearAuthToken();
      toast({
        title: "Signed out",
        description: "You have been logged out of the workspace.",
      });
      router.push("/login");
      router.refresh();
    }
  };

  const quickNavItems = [
    { label: "Create New Assessment", href: "/dashboard/exams/create", icon: Sparkles },
    { label: "Live Proctoring Monitor", href: "/dashboard/live", icon: ShieldAlert },
    { label: "Results & Gradebook", href: "/dashboard/results", icon: UserCheck },
  ].filter((item) =>
    searchQuery.trim()
      ? item.label.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6 lg:px-8",
        className
      )}
    >
      {/* Left: Mobile hamburger */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden rounded-xl"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Interactive Search Bar with Ctrl+K shortcut badge */}
        <div className="relative hidden md:block w-72 lg:w-96" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search exams, candidates…"
              className="h-10 w-full rounded-xl border-border/40 bg-secondary/40 pl-9 pr-14 text-sm placeholder:text-muted-foreground/70 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              )}
            </div>

            {/* Quick Search Dropdown */}
            {searchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border/60 bg-popover/95 p-2 text-popover-foreground shadow-2xl backdrop-blur-xl z-50 animate-in fade-in-0 zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {searchQuery ? `Matching "${searchQuery}"` : "Quick Navigation"}
                </div>
                <div className="mt-1 space-y-1">
                  {quickNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(item.href);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-indigo-500" />
                          <span>{item.label}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    );
                  })}

                  {searchQuery.trim() && (
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between rounded-xl border-t border-border/40 px-3 py-2 text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 transition-colors mt-1"
                    >
                      <span>Press Enter to search &ldquo;{searchQuery}&rdquo;</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            onClick={() => setNotifOpen(!notifOpen)}
            className={cn(
              "relative rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground",
              notifOpen && "bg-secondary text-foreground"
            )}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 ring-2 ring-background"></span>
              </span>
            )}
          </Button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-border/60 bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-xl z-50 animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5 px-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-foreground">Alerts & Events</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="text-xs text-muted-foreground hover:text-destructive font-medium transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    <Check className="mx-auto h-6 w-6 text-muted-foreground/40 mb-1" />
                    All caught up
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={cn(
                        "group flex cursor-pointer items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-secondary/60",
                        !item.read && "bg-secondary/30 font-medium"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs",
                          item.type === "alert"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : item.type === "submission"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        )}
                      >
                        {item.type === "alert" ? (
                          <ShieldAlert className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {item.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground/70 shrink-0">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      {!item.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile pill */}
        <div className="flex items-center gap-3 border-l border-border/40 pl-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="truncate text-xs font-bold text-foreground">
              {t.name}
            </span>
            {t.email && (
              <span className="truncate text-[10px] text-muted-foreground font-mono">
                {t.email}
              </span>
            )}
          </div>
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-xs font-bold text-white shadow-sm shadow-indigo-500/20"
          >
            {initials(t.name)}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
