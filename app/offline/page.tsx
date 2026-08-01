"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflineFallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-indigo-400 ring-8 ring-slate-800/50">
          <WifiOff className="h-10 w-10 animate-pulse" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
          You are Offline
        </h1>

        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Examora detected a network disconnection. Exam answers entered so far are automatically saved locally on your device.
        </p>

        <div className="mt-6 rounded-xl border border-indigo-900/40 bg-indigo-950/30 p-4 text-left">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            ✓ Offline Auto-Save Active
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Once internet connectivity is restored, your exam progress will automatically synchronize with the server.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Retry Connection
          </Button>
          <Link href="/">
            <Button variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-white gap-2">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
