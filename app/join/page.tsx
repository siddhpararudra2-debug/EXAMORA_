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
      setError("Please enter your Exam ID or invite link.");
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
    <main className="min-h-screen w-full bg-background flex items-center justify-center p-4 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 mb-3"
          >
            <GraduationCap className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Join an Examination
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Enter the access code or invitation URL from your instructor.
          </p>
        </div>

        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm rounded-lg">
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleJoin} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="examCode" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Exam PIN or Full Invite Link
                </Label>
                <Input
                  id="examCode"
                  placeholder="e.g. 7a8b9c-4f12 or paste URL"
                  value={examCode}
                  onChange={(e) => {
                    setExamCode(e.target.value);
                    if (error) setError("");
                  }}
                  className="h-10 text-xs font-mono border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900"
                  autoFocus
                />
              </div>

              <Button type="submit" className="h-9 w-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 gap-1.5">
                Continue to Student Verification <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>

            <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-3 text-xs text-zinc-500 space-y-2">
              <span className="font-medium text-zinc-700 dark:text-zinc-300 block text-[11px]">
                Requirements for this session:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Video className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                  <span>Working Webcam</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wifi className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                  <span>Stable Connection</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                  <span>Stay on Exam Tab</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                  <span>Auto-submit Timer</span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-zinc-100 dark:border-zinc-800 py-3.5 text-center text-xs">
            <p className="text-zinc-500 text-[11px]">
              Are you an educator?{" "}
              <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                Sign in here →
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
