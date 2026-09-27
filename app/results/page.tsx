"use client";

import Link from "next/link";
import { GraduationCap, Download, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * How students get scorecards (spec §6.7): there are no student accounts
 * and no anonymous lookup — scorecards reach students via the download
 * button on the post-submission screen and via email when the teacher
 * declares results. This page says exactly that instead of a search box
 * wired to an endpoint that never existed.
 */
export default function StudentResultsLookupPage() {
  return (
    <main className="min-h-screen w-full bg-background relative overflow-hidden p-6 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-500">
        <header className="flex items-center justify-between border-b border-border/40 pb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight text-foreground">Examora</span>
          </Link>

          <Link href="/login">
            <Button variant="outline" size="sm">
              Educator Login
            </Button>
          </Link>
        </header>

        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Where is my scorecard?
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Examora has no student accounts, so scorecards reach you two ways —
            never through a public lookup.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <Download className="h-6 w-6 text-primary" />
              <CardTitle className="mt-2 text-lg font-bold">
                Right after submitting
              </CardTitle>
              <CardDescription>
                The confirmation screen shown immediately after you submit
                offers a “Download your scorecard” button for your own
                session.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Mail className="h-6 w-6 text-primary" />
              <CardTitle className="mt-2 text-lg font-bold">
                By email after declaration
              </CardTitle>
              <CardDescription>
                Once your teacher declares results, your marksheet PDF is
                emailed to the address you entered when joining.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Taking an exam right now? Head to the join page with your exam
              code.
            </p>
            <Button asChild>
              <Link href="/join">
                Join an exam <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
