"use client";

import * as React from "react";
import { Sidebar, MobileSidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="flex min-h-screen flex-col lg:pl-72">
        <TopNav onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-3 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl animate-in fade-in duration-500">{children}</div>
        </main>
      </div>
    </div>
  );
}
