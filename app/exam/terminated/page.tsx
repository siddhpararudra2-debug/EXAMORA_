"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Home,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Reason =
  | "warnings"
  | "teacher"
  | "timeout"
  | "submitted"
  | string
  | null;

function getReasonInfo(reason: Reason) {
  if (reason === "submitted") {
    return {
      title: "Submission Successful",
      subtitle:
        "Your answers have been received. Your teacher will review your work shortly.",
      icon: ShieldCheck,
      tone: "emerald",
    } as const;
  }
  if (reason === "timeout") {
    return {
      title: "Time is up",
      subtitle:
        "The exam window closed. Your work up to this point was saved automatically.",
      icon: ShieldAlert,
      tone: "amber",
    } as const;
  }
  if (reason === "teacher") {
    return {
      title: "Exam ended by teacher",
      subtitle:
        "Your teacher closed the exam. Any answers submitted so far have been retained.",
      icon: ShieldAlert,
      tone: "indigo",
    } as const;
  }
  // warnings / default
  return {
    title: "Your exam has been terminated",
    subtitle:
      "The proctoring system detected repeated violations of the exam integrity policy. Any answers submitted up to this point have been retained.",
    icon: ShieldX,
    tone: "red",
  } as const;
}

function TerminatedContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = (params.get("reason") ?? "warnings") as Reason;
  const warnings = Number(params.get("warnings"));
  const limit = Number(params.get("limit")) || 3;
  const examId = params.get("examId") ?? undefined;

  const info = getReasonInfo(reason);
  const Icon = info.icon;

  const [redirecting, setRedirecting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (reason === "submitted") return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return c;
        if (c <= 1) {
          clearInterval(t);
          setRedirecting(true);
          router.push("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [reason, router]);

  const toneClasses: Record<
    "emerald" | "amber" | "indigo" | "red",
    { ring: string; bgTint: string; text: string; iconTint: string; badge: string; bgSoft: string }
  > = {
    emerald: {
      ring: "ring-emerald-500/20",
      bgTint: "bg-emerald-500/5",
      text: "text-emerald-500",
      iconTint: "text-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-500",
      bgSoft: "bg-emerald-500/10",
    },
    amber: {
      ring: "ring-amber-500/20",
      bgTint: "bg-amber-500/5",
      text: "text-amber-500",
      iconTint: "text-amber-500",
      badge: "bg-amber-500/10 text-amber-500",
      bgSoft: "bg-amber-500/10",
    },
    indigo: {
      ring: "ring-primary/20",
      bgTint: "bg-primary/5",
      text: "text-primary",
      iconTint: "text-primary",
      badge: "bg-primary/10 text-primary",
      bgSoft: "bg-primary/10",
    },
    red: {
      ring: "ring-destructive/20",
      bgTint: "bg-destructive/5",
      text: "text-destructive",
      iconTint: "text-destructive",
      badge: "bg-destructive/10 text-destructive",
      bgSoft: "bg-destructive/10",
    },
  };

  const tone = toneClasses[info.tone];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />

      <Card className="glass-panel w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-500 relative z-10 border-border/40">
        <div
          className={cn(
            "flex items-center justify-center border-b border-border/40 py-10 transition-colors",
            tone.bgSoft
          )}
        >
          <div
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-2xl bg-background shadow-sm ring-1",
              tone.ring,
              tone.iconTint
            )}
            aria-hidden
          >
            <Icon className="h-10 w-10" />
          </div>
        </div>
        <CardHeader className="pb-0 pt-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                tone.badge
              )}
            >
              {info.tone === "emerald"
                ? "Submission complete"
                : info.tone === "red"
                ? "Exam terminated"
                : info.tone === "amber"
                ? "Exam closed"
                : "Exam ended"}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {info.title}
          </CardTitle>
          <CardDescription className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            {info.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 p-6 sm:p-8">
          <dl className="grid grid-cols-2 gap-4 rounded-xl bg-secondary/30 p-6 border border-border/40">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Final warnings
              </dt>
              <dd
                className={cn(
                  "mt-2 text-2xl font-bold",
                  info.tone === "red" ? "text-destructive" : "text-foreground"
                )}
              >
                {Number.isFinite(warnings) && warnings >= 0 ? warnings : "—"}
                <span className="text-sm font-medium text-muted-foreground">
                  {" "}
                  / {limit}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Exam ID
              </dt>
              <dd className="mt-2 truncate font-mono text-sm font-medium text-foreground">
                {examId ?? "—"}
              </dd>
            </div>
          </dl>

          <div
            className={cn(
              "rounded-xl p-5 text-sm font-medium border",
              tone.bgTint,
              tone.ring,
              tone.text
            )}
            role="status"
          >
            {reason === "submitted" ? (
              <p>
                <span className="font-bold">Great work!</span> You can
                safely close this tab. Your teacher will notify you when
                results are available.
              </p>
            ) : redirecting || countdown !== null ? (
              <p>
                <span className="font-bold">
                  Redirecting to the home page in{" "}
                  {countdown ?? 0}…
                </span>{" "}
                If nothing happens, use the button below.
              </p>
            ) : (
              <p>
                If you believe this was a mistake, please contact your
                teacher or proctor and reference the Exam ID above.
              </p>
            )}
          </div>

          <div className="flex flex-col items-stretch justify-center gap-3 pt-2 sm:flex-row">
            <Button asChild variant="outline" className="h-12 border-border/40">
              <Link href="/">
                <Home className="mr-2 h-5 w-5" />
                Back to home
              </Link>
            </Button>
            {reason !== "submitted" && (
              <Button asChild className="h-12">
                <Link href="/exam/join">
                  Join another exam
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function TerminatedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>}>
      <TerminatedContent />
    </Suspense>
  );
}
