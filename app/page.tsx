import { GraduationCap, BookOpen, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-700 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Examora
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features">Features</a>
            <a href="#exams">Exams</a>
            <a href="#teachers">Teachers</a>
            <a href="#students">Students</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
            <Button size="sm">Get started</Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            100% Free &amp; Open-Source
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            A smarter way to run online exams.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Examora is a clean, modern exam platform built for educators and
            students. Schedule assessments, enable AI proctoring, and review
            results — all in one place.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg">Create your first exam</Button>
            <Button size="lg" variant="secondary">
              View on GitHub
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Everything you need for fair, reliable exams
          </h2>
          <p className="mt-4 text-slate-600">
            Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui for a
            professional and accessible educational experience.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="border-slate-200 bg-white">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Examora. Released under the MIT License.
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-900">Privacy</a>
            <a href="#" className="hover:text-slate-900">Terms</a>
            <a href="#" className="hover:text-slate-900">Docs</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
