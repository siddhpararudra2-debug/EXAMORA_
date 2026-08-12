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
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
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
  badge?: string;
}

export const teacherCoreNav: NavItem[] = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Activity & metrics",
  },
  {
    name: "Create Exam",
    href: "/dashboard/exams/create",
    icon: PlusCircle,
    description: "AI or manual assessment",
    badge: "AI",
  },
];

export const teacherMonitorNav: NavItem[] = [
  {
    name: "Live Supervision",
    href: "/dashboard/live",
    icon: MonitorPlay,
    description: "Real-time candidate streams",
  },
  {
    name: "Results & Gradebook",
    href: "/dashboard/results",
    icon: BarChart2,
    description: "PDF scorecards & distribution",
  },
];

interface SidebarProps {
  className?: string;
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 group"
      aria-label="Examora dashboard"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-transform group-hover:scale-105">
        <GraduationCap className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
          Examora
          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            PRO
          </span>
        </span>
        <span className="text-[11px] text-muted-foreground font-medium">Educator Workspace</span>
      </div>
    </Link>
  );
}

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                  : "bg-secondary/60 text-muted-foreground group-hover:bg-background group-hover:text-foreground"
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col min-w-0">
              <span className="truncate">{item.name}</span>
              {item.description && (
                <span className="text-[11px] font-normal leading-tight text-muted-foreground/70 group-hover:text-muted-foreground transition-colors truncate">
                  {item.description}
                </span>
              )}
            </span>
            {item.badge && (
              <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border/40 bg-background/95 backdrop-blur-xl lg:flex",
        className
      )}
      aria-label="Sidebar"
    >
      <div className="flex h-16 items-center border-b border-border/40 px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-6 space-y-6">
        <NavSection title="Core Platform" items={teacherCoreNav} />
        <NavSection title="Monitoring & Results" items={teacherMonitorNav} />
      </div>

      {/* System Status Footer Card */}
      <div className="border-t border-border/40 p-4">
        <div className="rounded-xl border border-border/40 bg-secondary/30 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Proctor Engine
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              Operational
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            WebRTC streaming & auto-submit sweeps active.
          </p>
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
        <div className="flex-1 overflow-y-auto px-3.5 py-6 space-y-6">
          <NavSection
            title="Core Platform"
            items={teacherCoreNav}
            onNavigate={() => onOpenChange(false)}
          />
          <NavSection
            title="Monitoring & Results"
            items={teacherMonitorNav}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
        <div className="border-t border-border/40 p-4">
          <div className="rounded-xl border border-border/40 bg-secondary/30 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Proctor Engine
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              WebRTC & AI grading active.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
