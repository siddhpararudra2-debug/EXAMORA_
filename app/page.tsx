"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  FileText,
  KeyRound,
  Clock,
  Users,
  BarChart2,
  Lock,
  ChevronRight,
  Eye,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"builder" | "proctor" | "gradebook">("builder");

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 dark:border-zinc-800 bg-background/95 backdrop-blur-sm">
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
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-20 text-center">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-wide uppercase mb-4">
          Open-source examination platform
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-3xl mx-auto leading-[1.12]">
          Reliable online exams with on-device AI proctoring
        </h1>

        <p className="mt-6 text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Create structured assessments, monitor integrity through browser-side AI detection, and auto-grade results. No camera footage ever leaves the student&apos;s device.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-11 px-6 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors">
              Create Educator Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/join" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 px-6 text-sm font-medium border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
              <KeyRound className="mr-2 h-4 w-4 text-zinc-500" />
              Join with Exam Code
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-zinc-400" /> Privacy-first architecture
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-zinc-400" /> On-device face detection
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-zinc-400" /> No student install required
          </span>
        </div>

        {/* Product Interface Preview */}
        <div className="mt-16 max-w-5xl mx-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden text-left">
          {/* Tab Bar */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 px-4 py-2.5">
            <span className="text-[11px] font-medium text-zinc-500 tracking-wide">examora.app/dashboard</span>

            <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded-md">
              {(["builder", "proctor", "gradebook"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    activeTab === tab
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  {tab === "builder" ? "Exam Creator" : tab === "proctor" ? "Live Monitoring" : "Results"}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-5 sm:p-6 bg-white dark:bg-zinc-950">
            {activeTab === "builder" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Exam Configuration
                  </span>
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="text-zinc-500">Title:</span>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">CS 301 — Computer Networks Midterm</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Duration:</span>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">60 Minutes · 40 Marks</p>
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
                      Question 1 of 20 · Multiple Choice
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">2 Marks</span>
                  </div>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    Which transport layer protocol provides connection-oriented, reliable byte-stream delivery with congestion control?
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                      A. User Datagram Protocol (UDP)
                    </div>
                    <div className="p-2.5 rounded border border-zinc-900 dark:border-zinc-100 bg-zinc-900/5 dark:bg-zinc-100/5 font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                      <span>B. Transmission Control Protocol (TCP)</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div className="p-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                      C. Internet Control Message Protocol (ICMP)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "proctor" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">CS 301 Midterm — Live Session</h4>
                    <p className="text-[11px] text-zinc-500">28 students connected · On-device AI monitoring active</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-900/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>

                {/* Signal-based monitoring, not video grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: "#1042", name: "Student A", status: "Focused", warnings: 0, icon: Eye },
                    { id: "#1089", name: "Student B", status: "Tab switch detected", warnings: 1, icon: AlertTriangle },
                    { id: "#1105", name: "Student C", status: "Focused", warnings: 0, icon: Eye },
                    { id: "#1117", name: "Student D", status: "Focused", warnings: 0, icon: Eye },
                  ].map((s) => {
                    const Icon = s.icon;
                    const hasWarning = s.warnings > 0;
                    return (
                      <div key={s.id} className={`rounded-md border p-3 flex items-center justify-between ${
                        hasWarning
                          ? "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40"
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-md flex items-center justify-center ${
                            hasWarning
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Candidate {s.id}</p>
                            <p className={`text-[11px] ${hasWarning ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}>
                              {s.status}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                          hasWarning
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                        }`}>
                          {s.warnings} / 3
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
                  Signals are generated by on-device AI running in each student&apos;s browser. No camera footage is transmitted.
                </p>
              </div>
            )}

            {activeTab === "gradebook" && (
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">CS 301 Midterm — Grade Summary</h4>
                    <p className="text-[11px] text-zinc-500">28 submissions evaluated</p>
                  </div>
                  <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded">
                    Class Avg: 84.2%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-zinc-500">Objective Questions</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">100% Auto-Graded</p>
                  </div>
                  <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-zinc-500">Short Answers</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">Rubric Evaluated</p>
                  </div>
                  <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-zinc-500">PDF Scorecards</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">Ready to Download</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="border-t border-zinc-200/80 dark:border-zinc-800 py-20 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Core Capabilities
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Designed for simple setup and dependable execution.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: FileText,
                title: "Flexible Question Authoring",
                desc: "Build assessments with multiple choice, true/false, and short answer questions. Import existing papers or generate questions with AI.",
              },
              {
                icon: ShieldCheck,
                title: "Tab Switch and Focus Tracking",
                desc: "Monitors tab switching, window blur events, and clipboard actions. Automatically logs warnings and flags activity for educator review.",
              },
              {
                icon: Cpu,
                title: "On-Device AI Proctoring",
                desc: "TensorFlow.js face detection runs entirely in the student's browser. No camera feed is transmitted to servers, preserving student privacy by design.",
              },
              {
                icon: CheckCircle2,
                title: "Automated and Assisted Grading",
                desc: "Immediate evaluation for objective sections, with AI-assisted rubric scoring for descriptive questions. Educators can review and override any grade.",
              },
              {
                icon: BarChart2,
                title: "PDF Scorecards and Analytics",
                desc: "Generate downloadable scorecards with question-by-question breakdowns. View class-level performance analytics across sessions.",
              },
              {
                icon: Users,
                title: "Frictionless Student Join",
                desc: "Candidates join with an exam access code or direct URL. No student accounts, no app downloads, no setup friction.",
              },
            ].map((f, idx) => {
              const Icon = f.icon;
              return (
                <div key={idx} className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
                  <div className="h-8 w-8 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.title}</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="border-t border-zinc-200/80 dark:border-zinc-800 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Workflow
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              From setup to grade distribution in three steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { step: "01", title: "Create the Exam", desc: "Set duration, question types, total marks, and integrity monitoring settings. Use the question editor or import from AI." },
              { step: "02", title: "Share the Access Code", desc: "Students navigate to the join page and enter the exam code or scan a QR code. No accounts needed." },
              { step: "03", title: "Monitor and Grade", desc: "View live session telemetry as the exam runs, then review auto-graded results and export scorecards." },
            ].map((s, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2.5">
                <span className="text-xs font-mono font-semibold text-zinc-400">{s.step}</span>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proctoring Detail Section */}
      <section id="proctoring" className="border-t border-zinc-200/80 dark:border-zinc-800 py-20 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
                Privacy-First Proctoring
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
                AI that runs in the browser, not on your servers.
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                Examora uses TensorFlow.js and BlazeFace to detect head posture and gaze direction directly on the student&apos;s device. The camera feed never leaves their browser. What reaches the educator is a set of timestamped signals, not video recordings.
              </p>

              <div className="space-y-3">
                {[
                  "Face presence and gaze direction analysis via BlazeFace",
                  "Tab switch, window blur, and clipboard event logging",
                  "AI overlay and browser extension detection",
                  "Mobile back-button and hardware button interception",
                  "Screen recording and virtual camera detection",
                  "Configurable warning threshold with automatic session termination",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="mt-0.5 h-4 w-4 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Activity className="h-2.5 w-2.5 text-zinc-500" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Proctoring Event Timeline</h4>
                <span className="text-[11px] text-zinc-500">Candidate #1089</span>
              </div>

              <div className="space-y-2.5">
                {[
                  { time: "14:02:11", event: "Session started", type: "info" as const },
                  { time: "14:08:43", event: "Tab switch detected", type: "warning" as const },
                  { time: "14:08:44", event: "Warning 1 of 3 issued", type: "warning" as const },
                  { time: "14:15:22", event: "Face not detected (2.1s)", type: "warning" as const },
                  { time: "14:15:23", event: "Warning 2 of 3 issued", type: "warning" as const },
                  { time: "14:31:05", event: "Exam submitted by student", type: "info" as const },
                ].map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[10px] font-mono text-zinc-400 pt-0.5 w-14 shrink-0">{entry.time}</span>
                    <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                      entry.type === "warning" ? "bg-amber-500" : "bg-zinc-400"
                    }`} />
                    <span className={`text-xs ${
                      entry.type === "warning"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {entry.event}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                These are automated signals for educator review, not confirmed findings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-zinc-200/80 dark:border-zinc-800 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Start organizing your exams with Examora.
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Free and open-source. Set up in minutes for classes, departments, and training programs.
          </p>
          <div className="pt-3 flex items-center justify-center gap-3">
            <Link href="/register">
              <Button size="sm" className="h-9 px-5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
                Create Account
              </Button>
            </Link>
            <Link href="/join">
              <Button size="sm" variant="outline" className="h-9 px-5 text-xs font-medium border-zinc-300 dark:border-zinc-700 transition-colors">
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
            <span>&copy; {new Date().getFullYear()}</span>
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
