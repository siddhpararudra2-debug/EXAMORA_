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
  User,
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
  name: z.string().min(2, { message: "Name is required (min 2 chars)" }),
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
  const [serverError, setServerError] = useState("");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setServerError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const result = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        data?: { user: { id: string; name: string; email: string }; token: string };
      };

      if (!res.ok) {
        setServerError(result?.message || "Failed to create account. Please try again.");
        return;
      }

      if (result?.data?.token) {
        setAuthToken(result.data.token);
        if (result.data.user) {
          setAuthUser(result.data.user);
        }
        toast({
          title: "Account Created!",
          description: `Welcome, ${result.data.user.name}. Redirecting to your dashboard.`,
        });
        
        router.push("/dashboard");
        router.refresh();
      } else {
        setServerError("Invalid server response.");
      }
    } catch (err) {
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

      <div className="relative z-10 w-full max-w-md px-4 sm:px-8 py-10">
        <div className="mb-10 text-center animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Link href="/" className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6 shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create an account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up to manage your exams and students.
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="John Doe"
                            type="text"
                            autoComplete="name"
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
                      <FormLabel className="text-sm font-medium">
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                          <Input
                            placeholder="••••••••"
                            type="password"
                            autoComplete="new-password"
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
                      Creating account…
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border/40 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
