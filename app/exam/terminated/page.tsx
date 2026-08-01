"use client";

import Link from "next/link";
import { ShieldAlert, AlertOctagon, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExamTerminatedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-red-900/50 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-950/80 text-red-500 ring-8 ring-red-900/30">
          <AlertOctagon className="h-10 w-10 animate-pulse" />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-red-400">
          Exam Terminated
        </h1>

        <p className="mt-3 text-slate-300 text-sm leading-relaxed">
          Your exam session was automatically terminated due to exceeding the maximum allowed proctoring violations (fullscreen exit, tab switching, or prohibited input actions).
        </p>

        <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-left">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-xs uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" /> Proctoring Log Recorded
          </div>
          <p className="mt-1 text-xs text-slate-400">
            All violations and automated actions have been logged and submitted to the exam administrator for review.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-white gap-2">
              <Home className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <Link href="/">
            <Button className="bg-red-600 hover:bg-red-700 text-white gap-2">
              <ArrowLeft className="h-4 w-4" /> Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
