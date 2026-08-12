"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  ArrowRight,
  KeyRound,
  AlertCircle,
  Video,
  ShieldCheck,
  Clock,
  Sparkles,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StudentJoinCodePage() {
  const router = useRouter();
  const [examCode, setExamCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = examCode.trim();
    if (!cleanCode) {
      setError("Please enter a valid Exam ID or paste the invite link.");
      return;
    }

    // Extract ID if a full URL was pasted
    let targetId = cleanCode;
    if (cleanCode.includes("/exam/")) {
      const match = cleanCode.match(/\/exam\/([^\/\?]+)/);
      if (match && match[1]) {
        targetId = match[1];
      }
    }

    router.push(`/exam/${encodeURIComponent(targetId)}/join`);
  };

  return (
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden p-4 sm:p-6 selection:bg-primary/20 selection:text-primary">
      {/* Radiant ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] mesh-glow pointer-events-none opacity-90" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Link
            href="/"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white mb-4 shadow-lg shadow-indigo-500/25 hover:scale-105 transition-transform"
          >
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Candidate Assessment Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your designated Exam ID or paste the invitation link from your instructor.
          </p>
        </div>

        <Card className="glass-panel border-slate-200/80 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-700">
          <CardHeader className="pt-6 border-b border-border/40 pb-4">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Exam Access PIN
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              No account creation required. Your identity will be registered on the next step.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <form onSubmit={handleJoin} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="examCode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Exam Code or Invite URL
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="examCode"
                    placeholder="e.g. 7a8b9c... or paste https://examora.app/..."
                    value={examCode}
                    onChange={(e) => {
                      setExamCode(e.target.value);
                      if (error) setError("");
                    }}
                    className="h-12 pl-10 pr-4 bg-secondary/30 focus:bg-background border-border/60 transition-colors rounded-xl text-sm font-mono"
                    autoFocus
                  />
                </div>
              </div>

              <Button type="submit" className="h-12 w-full gradient-brand text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 gap-2">
                Continue to Verification <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {/* Checklist items */}
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                Pre-Exam Checklist:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Webcam for proctoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Stable network connection</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Timer auto-submits on close</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Tab-switch tracking active</span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border/40 py-4 text-center bg-secondary/10 rounded-b-[14px]">
            <p className="text-xs text-muted-foreground">
              Are you an educator?{" "}
              <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Sign in to Dashboard →
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
