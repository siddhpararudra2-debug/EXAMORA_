import Link from "next/link";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Last updated: August 2026</p>

          <p className="text-foreground leading-relaxed">
            By accessing or using the Examora platform, you agree to these Terms of Service.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-6">1. Academic Integrity & Acceptable Use</h2>
          <p className="text-muted-foreground leading-relaxed">
            Candidates taking exams on Examora agree to follow their institution&apos;s code of conduct. Automated proctoring features exist to assist educators in ensuring fair examination standards.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-6">2. Open Source Licensing</h2>
          <p className="text-muted-foreground leading-relaxed">
            Examora is provided &quot;as is&quot; under the MIT open-source license without warranties of any kind.
          </p>
        </article>
      </div>
    </main>
  );
}
