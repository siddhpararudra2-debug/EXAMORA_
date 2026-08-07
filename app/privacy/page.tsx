import Link from "next/link";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background p-6 sm:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-center justify-between border-b border-border/40 pb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">Examora</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Home
            </Button>
          </Link>
        </header>

        <article className="prose prose-slate max-w-none space-y-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
          
          <p className="text-foreground leading-relaxed">
            Examora is a 100% free, open-source online examination platform. We prioritize privacy, candidate data security, and client-side processing.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-6">1. Client-Side AI & Data Processing</h2>
          <p className="text-muted-foreground leading-relaxed">
            Webcam feeds during proctored exams are analyzed directly within the candidate&apos;s browser using client-side AI algorithms (BlazeFace). Video streams are never continuously recorded to remote cloud servers without explicit user setup.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-6">2. Information We Store</h2>
          <p className="text-muted-foreground leading-relaxed">
            For teachers: Account email, display name, and hashed passwords. For candidates: Student name, enrollment ID, submitted examination answers, and timestamped violation events (e.g., tab switch counts).
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-6">3. Open Source Transparency</h2>
          <p className="text-muted-foreground leading-relaxed">
            Examora is open source software published under the MIT license. Educators can self-host the entire infrastructure for 100% data sovereignty.
          </p>
        </article>
      </div>
    </main>
  );
}
