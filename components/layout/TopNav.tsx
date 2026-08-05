"use client";

import * as React from "react";
import { LogOut, Menu, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface TopNavProps {
  className?: string;
  onMenuClick?: () => void;
  teacher?: {
    name: string;
    email?: string;
  };
}

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

import { getAuthUser, clearAuthToken } from "@/lib/auth-token";

// ...
export function TopNav({ className, onMenuClick, teacher }: TopNavProps) {
  const [authUser, setAuthUser] = React.useState<{ name: string; email?: string } | null>(null);

  React.useEffect(() => {
    const user = getAuthUser();
    if (user) {
      setAuthUser(user);
    }
  }, []);

  const t = teacher ?? authUser ?? DEFAULT_TEACHER;
  const { toast } = useToast();
  const router = useRouter();

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
        description: "You have been logged out of the teacher dashboard.",
      });
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/40 bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-5 lg:px-6",
        className
      )}
    >
      {/* Mobile: hamburger */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open navigation menu"
        className="shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Title for mobile context */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative hidden min-w-0 flex-1 md:block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Search exams, students, questions…"
            className="h-9 w-full max-w-xl border-border/40 bg-secondary/30 pl-9 text-sm placeholder:text-muted-foreground focus-visible:bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        <div className="hidden items-center gap-3 pr-1 sm:flex">
          <div className="flex flex-col items-end leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">
              {t.name}
            </span>
            {t.email && (
              <span className="truncate text-xs text-muted-foreground">
                {t.email}
              </span>
            )}
          </div>
          <div
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-background"
          >
            {initials(t.name)}
          </div>
        </div>

        {/* Mobile avatar */}
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm ring-2 ring-background sm:hidden"
        >
          {initials(t.name)}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="h-9 shrink-0 gap-1.5 border-border/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
