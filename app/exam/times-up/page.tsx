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
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />
      
      <Card className="glass-panel w-full max-w-lg text-center animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="items-center gap-4 pt-10">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Clock className="h-10 w-10" />
            <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Hourglass className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-500">
              Time&apos;s up
            </span>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-2">
              The exam time has ended
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
              Your answers were submitted automatically the moment the
              countdown hit 00:00. You don&apos;t need to do anything else.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pb-10 pt-4">
          {examId && (
            <p className="mx-auto max-w-sm truncate rounded-lg bg-secondary/50 px-4 py-2 text-xs font-mono text-muted-foreground border border-border/40">
              Exam ID: {examId}
            </p>
          )}
          <Button asChild className="h-12 gap-2 text-base w-full max-w-[240px] mx-auto">
            <Link href="/">
              <Home className="h-5 w-5" />
              Back to home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TimesUpPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>}>
      <TimesUpContent />
    </Suspense>
  );
}
