"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, ArrowRight, KeyRound, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
      setError("Please enter a valid Exam ID or Join Code.");
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
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden p-4">
      {/* Ambient background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(79,70,229,0.15) 0%, rgba(255,255,255,0) 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Link
            href="/"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-sm hover:scale-105 transition-transform"
          >
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Join an Exam</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your Exam ID or full invitation link provided by your educator.
          </p>
        </div>

        <Card className="glass-panel animate-in slide-in-from-bottom-8 fade-in duration-1000">
          <CardHeader className="pt-6">
            <CardTitle className="text-xl font-bold">Exam Access Code</CardTitle>
            <CardDescription>No account registration required for students.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200/50 bg-red-50/50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="examCode" className="text-sm font-medium">
                  Exam ID or Join Link
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="examCode"
                    placeholder="e.g. c1d84f89-... or paste link"
                    value={examCode}
                    onChange={(e) => {
                      setExamCode(e.target.value);
                      if (error) setError("");
                    }}
                    className="h-11 pl-9 pr-3 bg-white/50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <Button type="submit" className="h-11 w-full text-[15px] gap-2">
                Continue to Exam <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border/40 py-5 text-center">
            <p className="text-xs text-muted-foreground">
              Are you a teacher?{" "}
              <Link href="/login" className="font-medium text-foreground hover:underline">
                Sign in to Dashboard
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
