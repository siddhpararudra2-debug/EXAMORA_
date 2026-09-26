import Link from "next/link";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy — Examora",
  description: "How Examora handles your data, proctoring signals, and student information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-6 mb-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">Examora</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-zinc-500">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Button>
          </Link>
        </header>

        <article className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Privacy Policy</h1>
            <p className="text-xs text-zinc-500 mt-1.5">Last updated: September 2026</p>
          </div>

          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Examora is a free, open-source online examination platform. We prioritize privacy, student data security, and client-side processing. This policy explains what data we collect, how it is used, and how long it is retained.
          </p>

          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. On-Device AI Proctoring</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              When proctoring is enabled for an exam, the student&apos;s webcam input is analyzed directly within their browser using client-side AI (TensorFlow.js with BlazeFace). In the default configuration, no live camera feed, audio, snapshot, or recording is transmitted to educators or stored remotely. Examora records integrity event metadata only: event type, timestamp, warning count, and session status.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. Information We Store</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              For educators: account email, display name, and hashed passwords. For students: name, enrollment ID, submitted examination answers, and timestamped warning events (such as tab switch counts and face-detection signals). Student answer text and identity fields are retained until the owning educator explicitly deletes the exam.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. Proctoring Data Retention</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Detailed violation event metadata (such as browser signals and device-level telemetry captured during proctoring) is automatically purged 90 days after the exam&apos;s completion date. The event type and timestamp are retained for aggregate reporting purposes. Student identity fields and answers are retained until the educator deletes the associated exam.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">4. Open Source Transparency</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Examora is open-source software published under the MIT license. Educators can self-host the entire infrastructure for complete data sovereignty. The source code is publicly available for audit.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">5. Third-Party Services</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Examora optionally integrates with Groq for AI-powered question generation and document parsing. When this feature is used, the exam content (topic, subject matter, or uploaded document text) is sent to Groq&apos;s API. No student identity or answer data is shared with third-party services.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">6. Contact</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              For questions about this privacy policy or data handling, please open an issue on the project&apos;s GitHub repository or contact the platform administrator at your institution.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
