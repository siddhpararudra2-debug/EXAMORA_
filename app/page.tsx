import { GraduationCap, BookOpen, ClipboardCheck, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const features = [
  {
    icon: ClipboardCheck,
    title: "Smart Assessments",
    description:
      "Create exams with multiple-choice, short-answer, and long-answer questions with automated grading.",
  },
  {
    icon: ShieldCheck,
    title: "AI Proctoring",
    description:
      "Monitor exams with AI-driven face detection, tab-switch tracking, and violation logging.",
  },
  {
    icon: BookOpen,
    title: "Educator Dashboard",
    description:
      "Schedule exams, track live sessions, and review student performance with analytics.",
  },
  {
    icon: GraduationCap,
    title: "Student Experience",
    description:
      "Simple anonymous join flow with countdown timers and auto-submit on completion.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-30 pointer-events-none" 
           style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.05) 0%, rgba(255,255,255,0) 70%)' }} />

      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Examora
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="https://github.com/siddhpararudra2-debug/EXAMORA_" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Open Source</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:flex text-sm font-medium">
                Sign in
              </Button>
            </Link>
            <Link href="/dashboard/exams/create">
              <Button className="text-sm font-medium rounded-full px-6">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 pt-32 pb-24 text-center">
        <div className="animate-in slide-in-from-bottom-8 fade-in duration-1000">
          <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs font-semibold text-secondary-foreground mb-8">
            100% Free & Open-Source
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground max-w-4xl mx-auto leading-[1.1]">
            A smarter way to run <br className="hidden md:block" />
            <span className="text-muted-foreground">online exams.</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Examora is a beautifully minimal platform built for modern educators. 
            Schedule assessments, enable AI proctoring, and review results with ease.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard/exams/create">
              <Button size="lg" className="rounded-full px-8 h-12 text-base group">
                Create an exam 
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <a href="https://github.com/siddhpararudra2-debug/EXAMORA_" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-base">
                View Repository
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-5xl px-6 py-24 border-t border-border/50">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Everything you need. Nothing you don&apos;t.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, i) => (
            <Card key={feature.title} className="bg-card border-border/40 hover-lift group transition-all duration-300">
              <CardContent className="p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40 py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Examora. MIT License.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground font-medium">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="https://github.com/siddhpararudra2-debug/EXAMORA_" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
