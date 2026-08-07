"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Link
            href="/"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-sm"
          >
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your educator email to receive reset instructions.
          </p>
        </div>

        <Card className="glass-panel animate-in slide-in-from-bottom-8 fade-in duration-1000">
          <CardHeader className="pt-6">
            <CardTitle className="text-xl font-bold">Password Recovery</CardTitle>
            <CardDescription>We will send a reset link to your inbox.</CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="text-center py-4 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong>{email}</strong>, password reset instructions have been sent.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="teacher@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-9 pr-3 bg-white/50 focus:bg-white"
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading || !email.trim()} className="h-11 w-full text-[15px]">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending reset link…
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border/40 py-4">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
