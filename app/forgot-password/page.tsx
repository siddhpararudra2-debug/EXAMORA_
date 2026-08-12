"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Mail, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const result = (await res.json().catch(() => ({}))) as {
        message?: string;
        status?: string;
      };

      if (!res.ok) {
        setError(result?.message || "Failed to send the reset link. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please make sure the backend server is reachable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden p-4 sm:p-6 selection:bg-primary/20 selection:text-primary">
      {/* Radiant ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] mesh-glow pointer-events-none opacity-90" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Link
            href="/"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white mb-4 shadow-lg shadow-indigo-500/25 hover:scale-105 transition-transform"
          >
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Account Recovery
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your registered educator email to receive reset instructions.
          </p>
        </div>

        <Card className="glass-panel border-slate-200/80 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-700">
          <CardHeader className="pt-6 border-b border-border/40 pb-4">
            <CardTitle className="text-lg font-bold text-foreground">Password Recovery</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              We will send a secure one-time reset link to your institutional inbox.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {submitted ? (
              <div className="text-center py-4 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Check your inbox</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If an account exists for <strong className="text-foreground">{email}</strong>, password reset instructions have been dispatched.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Institutional Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="professor@university.edu"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      className="h-11 pl-10 pr-3 bg-secondary/30 focus:bg-background border-border/60 transition-colors rounded-xl text-sm"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="h-11 w-full gradient-brand text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Link…
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border/40 py-4 bg-secondary/10 rounded-b-[14px]">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Educator Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
