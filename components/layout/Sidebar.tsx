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
}

export const navItems: NavItem[] = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Create Exam",
    href: "/dashboard/exams/create",
    icon: PlusCircle,
  },
  {
    name: "Live Supervision",
    href: "/dashboard/live",
    icon: MonitorPlay,
  },
  {
    name: "Results & Gradebook",
    href: "/dashboard/results",
    icon: BarChart2,
  },
];

interface SidebarProps {
  className?: string;
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5"
      aria-label="Examora dashboard"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
        <GraduationCap className="h-4 w-4" aria-hidden />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Examora
        </span>
      </div>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Educator navigation">
      {navItems.map((item) => {
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="truncate">{item.name}</span>
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
        "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:flex",
        className
      )}
      aria-label="Sidebar"
    >
      <div className="flex h-14 items-center border-b border-zinc-200/80 dark:border-zinc-800 px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2 pb-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
          Navigation
        </div>
        <NavList />
      </div>

      {/* System Status Footer */}
      <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-3.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            System Online
          </span>
          <span className="font-mono text-zinc-400">v1.0</span>
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
        className="flex w-72 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-0 shadow-lg"
      >
        <SheetHeader className="flex h-14 flex-row items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-0">
          <SheetTitle asChild>
            <div className="sr-only">Navigation</div>
          </SheetTitle>
          <Brand />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="px-2 pb-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Navigation
          </div>
          <NavList onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              System Online
            </span>
            <span className="font-mono text-zinc-400">v1.0</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
