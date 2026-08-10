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
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
          title: "Signed in",
          description: user?.name
            ? `Welcome back, ${user.name}.`
            : "Redirecting to your dashboard.",
        });
      } else {
        toast({
          title: "Signed in",
          description: user?.name
            ? `Welcome back, ${user.name}.`
            : "Redirecting to your dashboard.",
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Network error. Please make sure the backend server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background relative flex items-center justify-center overflow-hidden">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />

      <div className="relative z-10 w-full max-w-md px-4 sm:px-8">
        <div className="mb-10 text-center animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Link href="/" className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6 shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your exams and students.
          </p>
        </div>

        <Card className="glass-panel animate-in slide-in-from-bottom-8 fade-in duration-1000">
          <CardContent className="pt-8">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
                noValidate
              >
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200/50 bg-red-50/50 px-4 py-3 text-sm text-red-700"
                  >
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
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
                      <FormLabel className="text-sm font-medium">
                        Email address
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="teacher@school.edu"
                            type="email"
                            autoComplete="email"
                            className="h-11 pl-9 pr-3 bg-white/50 focus:bg-white transition-colors"
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
                        <FormLabel className="text-sm font-medium">
                          Password
                        </FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="••••••••"
                            type="password"
                            autoComplete="current-password"
                            className="h-11 pl-9 pr-3 bg-white/50 focus:bg-white transition-colors"
                            {...field}
                            disabled={isLoading}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-11 w-full text-[15px]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border/40 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              New to Examora?{" "}
              <Link
                href="/register"
                className="font-medium text-foreground hover:underline"
              >
                Create an account
              </Link>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Are you a student?{" "}
              <Link
                href="/join"
                className="font-medium text-foreground hover:underline"
              >
                Join an exam
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}