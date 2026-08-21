"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  FileText,
  Video,
  KeyRound,
  Check,
  Clock,
  Users,
  BarChart2,
  Lock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"builder" | "proctor" | "gradebook">("builder");

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 dark:border-zinc-800 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Examora
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              How It Works
            </a>
            <a href="#proctoring" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Proctoring
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/join">
              <Button variant="ghost" size="sm" className="text-xs font-medium gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">
                <KeyRound className="h-3.5 w-3.5" />
                Join Exam
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-xs font-medium border-zinc-200 dark:border-zinc-800">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-6">
          <span>Examination & Live Supervision Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-4xl mx-auto leading-[1.15]">
          Reliable online exams. Built for academic integrity.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Create structured assessments, supervise students in real-time with WebRTC video and tab-switch logging, and export auto-graded scorecards.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-11 px-6 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
              Create Educator Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/join" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 px-6 text-sm font-medium border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <KeyRound className="mr-2 h-4 w-4 text-zinc-500" />
              Join with Exam PIN
            </Button>
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" /> No student install required
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" /> WebRTC live camera streams
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" /> Automated scorecard generation
          </span>
        </div>

        {/* Realistic Product Interface Mockup */}
        <div className="mt-14 max-w-5xl mx-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden text-left">
          {/* Mock Window Titlebar */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>
              <span className="text-[11px] font-mono text-zinc-500 ml-2">examora.app/dashboard</span>
            </div>

            {/* Realistic Tab Switcher */}
            <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => setActiveTab("builder")}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  activeTab === "builder"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Exam Creator
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("proctor")}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  activeTab === "proctor"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Live Supervision
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("gradebook")}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  activeTab === "gradebook"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Results & Gradebook
              </button>
            </div>
          </div>

          {/* Viewport Content */}
          <div className="p-5 sm:p-6 bg-white dark:bg-zinc-950">
            {activeTab === "builder" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Exam Configuration
                  </span>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-zinc-500">Title:</span>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">CS 301 — Computer Networks Midterm</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Duration:</span>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">60 Minutes • 40 Marks</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Integrity Rules:</span>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">Webcam required, Tab switch alert (3 max)</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Question 1 of 20 • Multiple Choice
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">2 Marks</span>
                  </div>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200">
                    Which transport layer protocol provides connection-oriented, reliable byte-stream delivery with congestion control?
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                      A. User Datagram Protocol (UDP)
                    </div>
                    <div className="p-2 rounded border border-zinc-900 dark:border-zinc-100 bg-zinc-900/5 dark:bg-zinc-100/5 font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                      <span>B. Transmission Control Protocol (TCP)</span>
                      <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                    </div>
                    <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                      C. Internet Control Message Protocol (ICMP)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "proctor" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { name: "Candidate #1042", status: "Active Stream", warnings: "0 flags", badge: "Normal" },
                  { name: "Candidate #1089", status: "Tab Switch Flagged", warnings: "1 warning", badge: "Warning" },
                  { name: "Candidate #1105", status: "Active Stream", warnings: "0 flags", badge: "Normal" },
                ].map((c, i) => (
                  <div key={i} className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2">
                    <div className="aspect-video rounded bg-zinc-900 dark:bg-zinc-950 flex items-center justify-center relative">
                      <Video className="h-6 w-6 text-zinc-600" />
                      <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> LIVE
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{c.warnings}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "gradebook" && (
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">CS 301 Midterm — Final Grade Summary</h4>
                    <p className="text-[11px] text-zinc-500">28 submissions evaluated</p>
                  </div>
                  <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded">
                    Class Avg: 84.2%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-zinc-500">Objective Questions</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">100% Auto-Graded</p>
                  </div>
                  <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-zinc-500">Short Answers</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">Rubric Evaluated</p>
                  </div>
                  <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-zinc-500">PDF Marksheets</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">Ready to Download</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="border-t border-zinc-200/80 dark:border-zinc-800 py-16 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Core Capabilities
            </h2>
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Designed for simple setup and dependable execution.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                title: "Flexible Question Authoring",
                desc: "Build assessments with multiple choice, true/false, and short answer questions. Import existing syllabi and question banks directly.",
              },
              {
                icon: ShieldCheck,
                title: "Lockdown & Tab Tracking",
                desc: "Monitors tab switching, window blurring, and clipboard actions. Automatically logs warnings and flags suspicious activity.",
              },
              {
                icon: Video,
                title: "WebRTC Live Proctoring",
                desc: "Stream real-time student camera feeds into a grid layout for seamless live oversight without heavy desktop software.",
              },
              {
                icon: CheckCircle2,
                title: "Automated & Assisted Grading",
                desc: "Immediate evaluation for objective sections, with structured rubric assistance for descriptive questions.",
              },
              {
                icon: BarChart2,
                title: "PDF Scorecards",
                desc: "Generate clean, downloadable marksheets with question-by-question breakdowns for each student.",
              },
              {
                icon: Users,
                title: "Frictionless Student Join",
                desc: "Candidates join with an exam access code or direct URL. No student accounts or app downloads needed.",
              },
            ].map((f, idx) => {
              const Icon = f.icon;
              return (
                <div key={idx} className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2.5">
                  <div className="h-8 w-8 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.title}</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works Workflow */}
      <section id="how-it-works" className="border-t border-zinc-200/80 dark:border-zinc-800 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Workflow
            </h2>
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Three steps from setup to grade distribution.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Create the Exam", desc: "Set duration, question types, total marks, and proctoring strictness settings." },
              { step: "02", title: "Share Access PIN", desc: "Students navigate to the join portal and enter the exam PIN to begin." },
              { step: "03", title: "Supervise & Grade", desc: "Monitor live sessions as they occur, review results, and export student scorecards." },
            ].map((s, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-2">
                <span className="text-xs font-mono font-semibold text-zinc-400">{s.step}</span>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clean Bottom Banner */}
      <section className="border-t border-zinc-200/80 dark:border-zinc-800 py-12 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center space-y-4">
          <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Start organizing your exams with Examora.
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Free and easy to set up for classes, departments, and training centers.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link href="/register">
              <Button size="sm" className="h-9 px-5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                Create Account
              </Button>
            </Link>
            <Link href="/join">
              <Button size="sm" variant="outline" className="h-9 px-5 text-xs font-medium border-zinc-300 dark:border-zinc-700">
                Join an Exam
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 dark:border-zinc-800 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Examora</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/join" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Student Join
            </Link>
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Educator Login
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
