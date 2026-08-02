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
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />
      
      <Card className="glass-panel w-full max-w-lg text-center animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="items-center gap-4 pt-10">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            {inactive ? (
              <CalendarX2 className="h-10 w-10" />
            ) : (
              <SearchX className="h-10 w-10" />
            )}
            <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-destructive">
              Exam unavailable
            </span>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-2">
              {inactive
                ? "This exam isn't active yet"
                : "Exam not found"}
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
              {inactive
                ? "The exam you're trying to open is still a draft or hasn't been published. Please check the link again once your teacher starts it."
                : "We couldn't find this exam. The link may be wrong, or the exam may have been removed."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pb-10 pt-4">
          <Button asChild variant="outline" className="h-12 gap-2 text-base w-full max-w-[240px] mx-auto border-border/40">
            <Link href="/">
              <Home className="h-5 w-5" />
              Back to home
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground/70">
            Contact your teacher if you believe this link should be working.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExamNotFoundPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>}>
      <ExamNotFoundContent />
    </Suspense>
  );
}
