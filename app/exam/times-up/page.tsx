"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Home, Hourglass } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function TimesUpContent() {
  const search = useSearchParams();
  const examId = search.get("examId");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg border-amber-200 bg-white text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-amber-100">
        <CardHeader className="items-center gap-4 pt-10">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 ring-1 ring-inset ring-amber-200">
            <Clock className="h-10 w-10 text-amber-600" />
            <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Hourglass className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-100">
              Time&apos;s up
            </span>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              The exam time has ended
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-slate-600 sm:text-base">
              Your answers were submitted automatically the moment the
              countdown hit 00:00. You don&apos;t need to do anything else.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-10">
          {examId && (
            <p className="mx-auto max-w-sm truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-500 ring-1 ring-inset ring-slate-100">
              Exam ID: {examId}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-11 gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TimesUpPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading...</div>}>
      <TimesUpContent />
    </Suspense>
  );
}
