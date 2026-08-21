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
  ShieldAlert,
  FileText,
  X,
  UserCheck,
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
    description: "Tab switch logged in active exam session.",
    time: "5m ago",
    read: false,
    type: "alert",
    href: "/dashboard/live",
  },
  {
    id: "n2",
    title: "New Exam Submission",
    description: "Candidate completed Computer Networks midterm.",
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

export function TopNav({ className, onMenuClick, teacher }: TopNavProps) {
  const [authUser, setAuthUser] = React.useState<{ name: string; email?: string } | null>(null);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [notifOpen, setNotifOpen] = React.useState<boolean>(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = React.useState("");
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

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast({
      title: "Marked as read",
      description: "All notifications updated.",
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
        description: "You have been logged out.",
      });
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/95 px-4 dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-6",
        className
      )}
    >
      {/* Left: Mobile menu & search */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="h-8 w-8 text-zinc-600 dark:text-zinc-400 lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <form onSubmit={handleSearchSubmit} className="relative hidden sm:block w-64 md:w-80">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exams or students…"
            className="h-8 w-full rounded-md border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 pl-8 pr-7 text-xs placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </form>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative h-8 w-8 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            )}
          </Button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 z-50">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 px-1">
                <span className="font-semibold text-xs">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    Mark read
                  </button>
                )}
              </div>

              <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400">
                    No notifications
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                        !item.read && "bg-zinc-50/70 dark:bg-zinc-800/40"
                      )}
                    >
                      <div className="mt-0.5 shrink-0 text-zinc-500">
                        {item.type === "alert" ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 border-l border-zinc-200 dark:border-zinc-800 pl-3">
          <div className="hidden sm:flex flex-col items-end leading-tight text-xs">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {t.name}
            </span>
            {t.email && (
              <span className="text-[11px] text-zinc-500 font-mono truncate max-w-[140px]">
                {t.email}
              </span>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
