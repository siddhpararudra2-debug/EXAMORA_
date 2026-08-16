"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  FileText,
  Activity,
  Award,
  Video,
  Lock,
  Cpu,
  Mail,
  ChevronRight,
  Eye,
  KeyRound,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"ai" | "proctoring" | "grading">("ai");

  return (
    <main className="min-h-screen bg-background text-foreground relative selection:bg-primary/20 selection:text-primary overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] mesh-glow pointer-events-none opacity-80" />

      {/* Sticky Glass Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-transform group-hover:scale-105">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                Examora
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  AI PRO
                </span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Platform
            </a>
            <a href="#workflow" className="hover:text-foreground transition-colors">
              Workflow
            </a>
            <a href="#proctoring" className="hover:text-foreground transition-colors">
              AI Proctoring
            </a>
            <a href="#results" className="hover:text-foreground transition-colors">
              Grading
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/join">
              <Button variant="ghost" className="hidden sm:inline-flex text-sm font-medium gap-1.5 text-muted-foreground hover:text-foreground">
                <KeyRound className="h-4 w-4" />
                Join Exam
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="text-sm font-medium border-border/60 hover:bg-secondary">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button className="gradient-brand text-sm font-semibold rounded-xl px-4 shadow-sm shadow-indigo-500/20 hover:opacity-95 transition-opacity">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-4 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-500" />
          <span>Next-Generation Examination & Autonomous AI Proctoring</span>
          <ChevronRight className="h-3 w-3 opacity-70" />
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.12] gradient-text animate-in fade-in slide-in-from-bottom-4 duration-700">
          Intelligent assessments. Real-time proctoring. Instant grading.
        </h1>

        <p className="mt-6 text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700">
          Examora equips universities, educators, and training programs with an enterprise-grade platform to generate tests with AI, supervise candidates via live WebRTC streams, and distribute automated scorecards in seconds.
        </p>

        {/* CTA Actions */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto gradient-brand rounded-xl px-8 h-13 text-base font-semibold shadow-lg shadow-indigo-500/25 group">
              Start as Educator
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/join" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl px-8 h-13 text-base font-medium border-border/80 bg-background/50 hover:bg-secondary">
              <KeyRound className="mr-2 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Join Exam as Student
            </Button>
          </Link>
        </div>

        <div className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-emerald-500" /> No student account required
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Instant PDF scorecard generator
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-emerald-500" /> WebRTC live video proctoring
          </span>
        </div>

        {/* Interactive Platform Preview Mockup */}
        <div className="mt-16 sm:mt-20 max-w-5xl mx-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card/80 p-2 sm:p-3 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-1000">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 px-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">examora.app/dashboard</span>
            </div>

            {/* Interactive Preview Tabs */}
            <div
              role="tablist"
              aria-label="Platform capability preview"
              className="flex items-center gap-1 bg-secondary/70 p-1 rounded-xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ai"}
                onClick={() => setActiveTab("ai")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "ai"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                AI Exam Generator
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "proctoring"}
                onClick={() => setActiveTab("proctoring")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "proctoring"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Video className="h-3.5 w-3.5 text-indigo-500" />
                Live Supervision
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "grading"}
                onClick={() => setActiveTab("grading")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "grading"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Award className="h-3.5 w-3.5 text-indigo-500" />
                Instant Scorecards
              </button>
            </div>
          </div>

          {/* Dynamic Preview Viewport */}
          <div className="p-4 sm:p-6 text-left min-h-[340px] flex flex-col justify-center">
            {activeTab === "ai" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Step 1: Document Upload
                    </span>
                    <h4 className="text-sm font-semibold text-foreground mt-1">
                      Syllabus & Lecture Notes
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploaded <code>Advanced_Networking_Chap3.pdf</code> (2.4 MB)
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Parsed 45 Concepts
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      Generated Question #1 (Multiple Choice)
                    </span>
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none">
                      High Difficulty
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    Which transport layer mechanism prevents a fast sender from overwhelming a slow receiver?
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg border border-border/40 bg-background/80 text-muted-foreground">
                      A. Congestion Control
                    </div>
                    <div className="p-2 rounded-lg border border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold flex items-center justify-between">
                      <span>B. Flow Control (Sliding Window)</span>
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="p-2 rounded-lg border border-border/40 bg-background/80 text-muted-foreground">
                      C. Header Checksumming
                    </div>
                    <div className="p-2 rounded-lg border border-border/40 bg-background/80 text-muted-foreground">
                      D. Three-Way Handshake
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "proctoring" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    name: "Alex Rivera",
                    status: "Secure",
                    violation: "0 flags",
                    score: "Q12/20",
                    tone: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    name: "Jordan Smith",
                    status: "Tab Switched",
                    violation: "1 warning logged",
                    score: "Q8/20",
                    tone: "text-amber-600 dark:text-amber-400",
                  },
                  {
                    name: "Taylor Reed",
                    status: "Face Verified",
                    violation: "Active stream",
                    score: "Q15/20",
                    tone: "text-emerald-600 dark:text-emerald-400",
                  },
                ].map((candidate, idx) => (
                  <div key={idx} className="rounded-xl border border-border/60 bg-secondary/30 p-3 flex flex-col justify-between">
                    <div className="aspect-video rounded-lg bg-slate-950 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <Video className="h-8 w-8 text-slate-700" />
                      <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                      <span className="absolute bottom-2 left-2 text-xs font-semibold text-white">
                        {candidate.name}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${candidate.tone}`}>
                        {candidate.status}
                      </span>
                      <span className="text-muted-foreground font-mono">{candidate.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "grading" && (
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Computer Science Midterm — Final Gradebook</h4>
                    <p className="text-xs text-muted-foreground">32 candidates graded with AI rubrics in 4.2 seconds</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                      Avg: 88.4%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-background/80 border border-border/40">
                    <span className="text-muted-foreground">Highest Score</span>
                    <p className="text-lg font-bold text-foreground mt-1">98 / 100</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/80 border border-border/40">
                    <span className="text-muted-foreground">AI Subjective Match</span>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">99.4% Accuracy</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/80 border border-border/40">
                    <span className="text-muted-foreground">PDF Reports</span>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">Ready for Email</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="border-y border-border/50 bg-secondary/20 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-foreground">99.9%</p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">Platform Reliability</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">&lt; 100ms</p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">WebRTC Video Latency</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-foreground">100%</p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">Automated AI Grading</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">0s Delay</p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">Instant Student Join</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <span id="results" className="block scroll-mt-24" aria-hidden="true" />
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
            Built for Modern Education
          </h2>
          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Everything you need for secure, high-integrity examinations.
          </h3>
          <p className="mt-4 text-muted-foreground">
            Designed for professors, instructional designers, and training organizations who demand seamless setup and uncompromised integrity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Cpu,
              title: "AI Assessment Generation",
              desc: "Upload syllabi, lecture slides, or textbooks. Generate rigorous multiple-choice, true/false, and subjective question sets in seconds.",
            },
            {
              icon: ShieldCheck,
              title: "Lockdown & Integrity Guard",
              desc: "Tracks browser tab switches, clipboard activity, fullscreen drops, and window focus loss with automated warning increments.",
            },
            {
              icon: Video,
              title: "Multi-Camera Live Supervision",
              desc: "Real-time WebRTC video and audio streams for every candidate with proctoring flags, snapshot captures, and low latency.",
            },
            {
              icon: Award,
              title: "LLM Subjective Grading",
              desc: "AI grading engine evaluates long-form answers against educator rubrics with semantic keyword analysis and granular feedback.",
            },
            {
              icon: FileText,
              title: "One-Click Scorecard PDF",
              desc: "Generate professional branded scorecards with grade summaries, performance graphs, and question breakdowns ready for download.",
            },
            {
              icon: Mail,
              title: "Batch Email Distribution",
              desc: "Notify candidates instantly with their marks, feedback, and downloadable scorecards via integrated SMTP notifications.",
            },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Card key={i} className="glass-panel hover-lift border-border/60">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground tracking-tight">{feature.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Integrity & privacy promise */}
      <section id="proctoring" className="border-y border-border/50 bg-slate-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Integrity by design
              </div>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Strong signals. Clear context. Human review.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Examora makes integrity events visible without turning the student experience into a black box. Educators see what happened, when it happened, and which session needs attention before making a decision.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold text-slate-200">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Signals, not verdicts</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Device-first detection</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Auditable timelines</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Eye,
                  title: "Visible to students",
                  body: "Warnings are explained in plain language so candidates always know what the system recorded.",
                },
                {
                  icon: Activity,
                  title: "Live to educators",
                  body: "Realtime status updates help supervisors focus on the candidates who need context.",
                },
                {
                  icon: Lock,
                  title: "Private by default",
                  body: "Browser-side signals stay focused on assessment integrity and are tied to an owned session.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-indigo-950/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-sm font-bold">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Workflow */}
      <section id="workflow" className="border-t border-border/50 bg-secondary/10 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
              Simple 4-Step Process
            </h2>
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              From syllabus to final gradebook in minutes.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Create or AI Generate", desc: "Build questions manually or parse existing syllabus documents with LLM assistance." },
              { step: "02", title: "Share Direct Link", desc: "Students join instantly via PIN or direct invitation URL without cumbersome registrations." },
              { step: "03", title: "Monitor Real-Time", desc: "Supervise active candidates with WebRTC streaming and automated anti-cheat telemetry." },
              { step: "04", title: "Review & Distribute", desc: "Review AI scores, adjust marks if needed, and export or email PDF scorecards in bulk." },
            ].map((step, idx) => (
              <div key={idx} className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <span className="text-4xl font-extrabold text-indigo-500/20">{step.step}</span>
                <h4 className="mt-3 text-base font-bold text-foreground">{step.title}</h4>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-3xl overflow-hidden gradient-brand p-8 sm:p-14 text-center shadow-2xl shadow-indigo-600/30">
          <div className="relative z-10 max-w-3xl mx-auto">
            <h3 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              Ready to elevate your online assessments?
            </h3>
            <p className="mt-4 text-indigo-100 text-base sm:text-lg">
              Join thousands of educators running smarter, secure, and stress-free exams today.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl px-8 font-bold shadow-lg">
                  Create Educator Account
                </Button>
              </Link>
              <Link href="/join" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10 rounded-xl px-8 font-medium">
                  Enter Student Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-bold text-foreground">Examora</span>
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium">
            <Link href="/join" className="hover:text-foreground transition-colors">
              Student Join
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Educator Login
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            All Systems Operational
          </div>
        </div>
      </footer>
    </main>
  );
}
