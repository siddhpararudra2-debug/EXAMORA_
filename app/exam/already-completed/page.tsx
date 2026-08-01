"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Home, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AlreadyCompletedPage() {
  const search = useSearchParams();
  const examId = search.get("examId");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg border-indigo-200 bg-white text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-indigo-100">
        <CardHeader className="items-center gap-4 pt-10">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 ring-1 ring-inset ring-indigo-200">
            <ShieldCheck className="h-10 w-10 text-indigo-600" />
            <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
              <Lock className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-100">
              Exam already completed
            </span>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              You&apos;ve already taken this exam
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-slate-600 sm:text-base">
              This session was already submitted or closed, so it can&apos;t be
              opened again. If you believe this is a mistake, contact your
              teacher.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-10">
          {examId && (
            <p className="mx-auto max-w-sm truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-500 ring-1 ring-inset ring-slate-100">
              Exam ID: {examId}
            </p>
          )}
          <Button asChild className="h-11 gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
