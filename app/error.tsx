"use client";

import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary (Next.js App Router convention). Catches render errors
 * on any page so users see a friendly screen instead of an empty page.
 */
export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-950/60 text-rose-400 ring-8 ring-rose-950/40">
          <AlertTriangle className="h-10 w-10" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
          Something went wrong
        </h1>

        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          An unexpected error occurred while rendering this page. Your exam
          data is safe. Try reloading the page, or head back home.
        </p>

        {process.env.NODE_ENV === "development" && error?.message ? (
          <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/30 p-4 text-left">
            <p className="text-xs font-mono text-rose-300 break-all">
              {error.message}
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-white gap-2"
            >
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
