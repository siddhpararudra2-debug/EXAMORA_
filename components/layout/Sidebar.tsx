"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusCircle,
  MonitorPlay,
  BarChart2,
  GraduationCap,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export const teacherNav: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview & activity",
  },
  {
    name: "Create Exam",
    href: "/dashboard/exams/create",
    icon: PlusCircle,
    description: "Build a new assessment",
  },
  {
    name: "Live Exams",
    href: "/dashboard/exams/live",
    icon: MonitorPlay,
    description: "Monitor active sessions",
  },
  {
    name: "Results",
    href: "/dashboard/results",
    icon: BarChart2,
    description: "Grades & analytics",
  },
];

interface SidebarProps {
  className?: string;
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 group"
      aria-label="Examora dashboard"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <GraduationCap className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">
        Examora
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Teacher navigation">
      {teacherNav.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            pathname?.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-300",
              isActive
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground group-hover:text-foreground group-hover:bg-background"
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col">
              <span>{item.name}</span>
              {item.description && (
                <span className="text-[11px] font-normal leading-4 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                  {item.description}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border/40 bg-background lg:flex",
        className
      )}
      aria-label="Sidebar"
    >
      <div className="flex h-16 items-center border-b border-border/40 px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="px-2 pb-3 text-xs font-semibold tracking-wider text-muted-foreground/60 uppercase">
          Workspace
        </div>
        <NavList />
      </div>

      <div className="border-t border-border/40 p-4">
        <div className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-3 text-xs text-muted-foreground border border-border/20">
          <span className="font-medium text-foreground">Examora</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
            Free · OSS
          </span>
        </div>
      </div>
    </aside>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-80 flex-col border-r-0 border-border/40 bg-background p-0 shadow-2xl"
      >
        <SheetHeader className="flex h-16 flex-row items-center justify-between border-b border-border/40 px-5 py-0">
          <SheetTitle asChild>
            <div className="sr-only">Navigation</div>
          </SheetTitle>
          <Brand />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="px-2 pb-3 text-xs font-semibold tracking-wider text-muted-foreground/60 uppercase">
            Workspace
          </div>
          <NavList onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="border-t border-border/40 p-4">
          <div className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-3 text-xs text-muted-foreground border border-border/20">
            <span className="font-medium text-foreground">Examora</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              Free · OSS
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
