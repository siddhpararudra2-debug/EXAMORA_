"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CalendarX2, Home, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ExamNotFoundContent() {
  const search = useSearchParams();
  const reason = search.get("reason");
  const inactive = reason === "inactive";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg border-slate-200 bg-white text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
        <CardHeader className="items-center gap-4 pt-10">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-inset ring-red-200">
            {inactive ? (
              <CalendarX2 className="h-10 w-10 text-red-500" />
            ) : (
              <SearchX className="h-10 w-10 text-red-500" />
            )}
            <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-700 ring-1 ring-inset ring-red-100">
              Exam unavailable
            </span>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {inactive
                ? "This exam isn&apos;t active yet"
                : "Exam not found"}
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-slate-600 sm:text-base">
              {inactive
                ? "The exam you&apos;re trying to open is still a draft or hasn&apos;t been published. Please check the link again once your teacher starts it."
                : "We couldn&apos;t find this exam. The link may be wrong, or the exam may have been removed."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-10">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            Contact your teacher if you believe this link should be working.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExamNotFoundPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading...</div>}>
      <ExamNotFoundContent />
    </Suspense>
  );
}
