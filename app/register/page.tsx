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
  User,
  ArrowRight,
  ShieldCheck,
  Check,
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

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function TeacherRegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onTouched",
  });

  const passwordValue = form.watch("password") || "";

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setServerError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
        }),
      });

      const result = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        error?: string;
        user?: { id: string; name: string; email: string };
        token?: string;
        data?: { user: { id: string; name: string; email: string }; token: string };
      };

      if (!res.ok) {
        setServerError(result?.message || result?.error || "Failed to create account. Please try again.");
        return;
      }

      const token = result?.data?.token || result?.token;
      const user = result?.data?.user || result?.user;

      if (token) {
        setAuthToken(token);
        if (user) {
          setAuthUser(user);
        }
        toast({
          title: "Account Created!",
          description: user?.name
            ? `Welcome, ${user.name}. Setting up your workspace.`
            : "Redirecting to your dashboard.",
        });
        
        router.push("/dashboard");
        router.refresh();
      } else {
        setServerError("Account created, but authentication token was not returned. Please sign in.");
      }
    } catch (err) {
      console.error("Register request failed:", err);
      setServerError("Network error. Please make sure the backend server is reachable.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden px-4 py-12 selection:bg-primary/20 selection:text-primary">
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
            Create Educator Account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Launch AI exams, supervise live candidate streams, and manage classes.
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="Dr. Jordan Mitchell"
                            type="text"
                            autoComplete="name"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Institutional Email
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
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="••••••••"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
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

                      {/* Password check indicator */}
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className={`flex items-center gap-1 ${passwordValue.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                          <Check className={`h-3 w-3 ${passwordValue.length >= 8 ? 'text-emerald-500' : 'opacity-40'}`} />
                          8+ characters
                        </span>
                        <span className="opacity-40">•</span>
                        <span>Encrypted with bcrypt</span>
                      </div>
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
                      Creating account…
                    </>
                  ) : (
                    <>
                      Complete Registration
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border/40 py-5 text-center bg-secondary/10 rounded-b-[14px]">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
