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
          title: "Signed in",
          description: user?.name
            ? `Welcome back, ${user.name}.`
            : "Opening your educator dashboard.",
        });
      } else {
        toast({
          title: "Signed in",
          description: "Opening your educator dashboard.",
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Network error. Please make sure the server is reachable.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background flex items-center justify-center p-4 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 mb-3"
          >
            <GraduationCap className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in to Examora
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Access your educator dashboard and exams.
          </p>
        </div>

        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm rounded-lg">
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="name@school.edu"
                          type="email"
                          autoComplete="email"
                          className="h-9 text-xs border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900"
                          {...field}
                          disabled={isLoading}
                        />
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
                        <FormLabel className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Password
                        </FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="••••••••"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            className="h-9 text-xs pr-8 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900"
                            {...field}
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
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
                  className="h-9 w-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2.5 border-t border-zinc-100 dark:border-zinc-800 py-4 text-center text-xs">
            <p className="text-zinc-500">
              New educator?{" "}
              <Link
                href="/register"
                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Create an account
              </Link>
            </p>
            <p className="text-[11px] text-zinc-400">
              Taking an exam?{" "}
              <Link href="/join" className="text-zinc-600 dark:text-zinc-300 underline">
                Enter student PIN
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}