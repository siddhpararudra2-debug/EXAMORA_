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
      className="flex items-center gap-2.5"
      aria-label="Examora dashboard"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-sm shadow-indigo-900/10">
        <GraduationCap className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-slate-900">
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
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                isActive
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm"
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col">
              <span>{item.name}</span>
              {item.description && (
                <span className="text-[11px] font-normal leading-4 text-slate-400 group-hover:text-slate-500">
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
        "fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex",
        className
      )}
      aria-label="Sidebar"
    >
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </div>
        <NavList />
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500 ring-1 ring-inset ring-slate-100">
          <span className="font-medium text-slate-600">Examora</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
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
        className="flex w-80 flex-col border-r-0 border-slate-200 bg-white p-0 shadow-2xl"
      >
        <SheetHeader className="flex h-16 flex-row items-center justify-between border-b border-slate-100 px-5 py-0">
          <SheetTitle asChild>
            <div className="sr-only">Navigation</div>
          </SheetTitle>
          <Brand />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </div>
          <NavList onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500 ring-1 ring-inset ring-slate-100">
            <span className="font-medium text-slate-600">Examora</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
              Free · OSS
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
