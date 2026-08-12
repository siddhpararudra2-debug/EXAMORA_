"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GraduationCap,
  Mail,
  LockKeyhole,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken, setAuthUser } from "@/lib/auth-token";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function TeacherLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setServerError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
        }),
      });

      const result = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        error?: string;
        ok?: boolean;
        user?: { id: string; name: string; email: string };
        token?: string;
        teacher?: { id: string; name: string; email: string };
        data?: { user: { id: string; name: string; email: string }; token: string };
      };

      if (!res.ok) {
        const msg =
          result?.message === "CredentialsSignin" || (!result?.message && !result?.error)
            ? "Invalid email or password"
            : result.message || result.error;
        setServerError(msg ?? "Invalid credentials");
        return;
      }

      const token = result?.data?.token || result?.token;
      const user = result?.data?.user || result?.user || result?.teacher;

      if (token) {
        setAuthToken(token);
        if (user) {
          setAuthUser(user);
        }
        toast({
          title: "Welcome back!",
          description: user?.name
            ? `Signed in as ${user.name}.`
            : "Redirecting to your educator dashboard.",
        });
      } else {
        toast({
          title: "Signed in",
          description: "Redirecting to dashboard.",
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Network error. Please ensure the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden px-4 py-12 selection:bg-primary/20 selection:text-primary">
      {/* Radiant ambient mesh glow */}
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
            Educator Workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to create assessments, supervise candidates, and export gradebooks.
          </p>
        </div>

        <Card className="glass-panel border-slate-200/80 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-700">
          <CardContent className="pt-8">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 animate-in fade-in"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
                      aria-hidden
                    />
                    <span>{serverError}</span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="professor@university.edu"
                            type="email"
                            autoComplete="email"
                            className="h-11 pl-10 pr-3 bg-secondary/30 focus:bg-background border-border/60 transition-colors rounded-xl"
                            {...field}
                            disabled={isLoading}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Password
                        </FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="••••••••"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            className="h-11 pl-10 pr-10 bg-secondary/30 focus:bg-background border-border/60 transition-colors rounded-xl"
                            {...field}
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-11 w-full gradient-brand text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign In to Workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/40 py-5 text-center bg-secondary/10 rounded-b-[14px]">
            <p className="text-sm text-muted-foreground">
              New educator?{" "}
              <Link
                href="/register"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Create an account
              </Link>
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 border-t border-border/30 w-full text-xs text-muted-foreground">
              <span>Are you a student taking an exam?</span>
              <Link
                href="/join"
                className="font-semibold text-foreground hover:text-indigo-600 transition-colors"
              >
                Enter Exam PIN →
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}