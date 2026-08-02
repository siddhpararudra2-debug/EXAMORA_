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
    { ring: string; bgTint: string; text: string; iconTint: string; badge: string }
  > = {
    emerald: {
      ring: "ring-emerald-100",
      bgTint: "bg-emerald-50",
      text: "text-emerald-700",
      iconTint: "text-emerald-600",
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    amber: {
      ring: "ring-amber-100",
      bgTint: "bg-amber-50",
      text: "text-amber-800",
      iconTint: "text-amber-600",
      badge: "bg-amber-50 text-amber-800 ring-amber-100",
    },
    indigo: {
      ring: "ring-indigo-100",
      bgTint: "bg-indigo-50",
      text: "text-indigo-800",
      iconTint: "text-indigo-600",
      badge: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    },
    red: {
      ring: "ring-red-100",
      bgTint: "bg-red-50",
      text: "text-red-700",
      iconTint: "text-red-600",
      badge: "bg-red-50 text-red-700 ring-red-100",
    },
  };

  const tone = toneClasses[info.tone];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100/60 p-4 sm:p-8">
      <Card className="w-full max-w-xl overflow-hidden border-slate-200 bg-white shadow-[0_12px_40px_-18px_rgba(15,23,42,0.2)] ring-1 ring-slate-100">
        <div
          className={cn(
            "flex items-center justify-center border-b py-10",
            tone.bgTint,
            `border-slate-100`
          )}
        >
          <div
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-4",
              tone.ring,
              tone.iconTint
            )}
            aria-hidden
          >
            <Icon className="h-10 w-10" />
          </div>
        </div>
        <CardHeader className="pb-0 pt-6 text-center">
          <div className="mb-3 flex items-center justify-center">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset",
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
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {info.title}
          </CardTitle>
          <CardDescription className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
            {info.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:p-8">
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-5 ring-1 ring-inset ring-slate-100">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Final warnings
              </dt>
              <dd
                className={cn(
                  "mt-1 text-2xl font-bold",
                  info.tone === "red" ? "text-red-600" : "text-slate-900"
                )}
              >
                {Number.isFinite(warnings) && warnings >= 0 ? warnings : "—"}
                <span className="text-sm font-normal text-slate-500">
                  {" "}
                  / {limit}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Exam ID
              </dt>
              <dd className="mt-1 truncate font-mono text-sm font-medium text-slate-800">
                {examId ?? "—"}
              </dd>
            </div>
          </dl>

          <div
            className={cn(
              "rounded-2xl p-4 text-sm ring-1 ring-inset",
              tone.bgTint,
              tone.ring,
              tone.text
            )}
            role="status"
          >
            {reason === "submitted" ? (
              <p>
                <span className="font-semibold">Great work!</span> You can
                safely close this tab. Your teacher will notify you when
                results are available.
              </p>
            ) : redirecting || countdown !== null ? (
              <p>
                <span className="font-semibold">
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

          <div className="flex flex-col items-stretch justify-end gap-2 pt-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Back to home
              </Link>
            </Button>
            <Button asChild className="bg-indigo-700 hover:bg-indigo-800">
              <Link href="/exam/join">
                Have another code? Join another exam{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function TerminatedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading...</div>}>
      <TerminatedContent />
    </Suspense>
  );
}
