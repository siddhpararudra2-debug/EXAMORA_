"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Search, FileText, CheckCircle2, Award, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ResultCard {
  id: string;
  examTitle: string;
  studentName: string;
  studentEmail: string;
  enrollmentNo: string;
  score: number;
  totalMarks: number;
  percentage: number;
  completedAt: string;
}

export default function StudentResultsLookupPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<ResultCard[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/v1/results/lookup?query=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const payload = await res.json();
        setResults(payload.data?.results || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

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
            Candidate Result & Scorecard Lookup
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Enter your registered email address or enrollment number to view official examination scorecards.
          </p>
        </div>

        <Card className="glass-panel">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter Email or Enrollment No (e.g. ada@example.com / CS2023-0042)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 pl-9 pr-3 bg-white/50 focus:bg-white"
                />
              </div>
              <Button type="submit" disabled={searching || !query.trim()} className="h-11 px-6 gap-2">
                {searching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Search Scorecard
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Found Results ({results.length})
            </h2>

            {results.length === 0 ? (
              <Card className="p-8 text-center bg-secondary/20 border-dashed">
                <p className="text-muted-foreground text-sm">
                  No published scorecards found matching &quot;{query}&quot;. Please verify your email or enrollment details.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results.map((r) => (
                  <Card key={r.id} className="glass-panel hover-lift">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3">
                      <div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-none mb-1 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> OFFICIAL SCORECARD
                        </Badge>
                        <CardTitle className="text-lg font-bold">{r.examTitle}</CardTitle>
                        <CardDescription>
                          Candidate: {r.studentName} ({r.enrollmentNo || r.studentEmail})
                        </CardDescription>
                      </div>

                      <div className="mt-3 sm:mt-0 text-right">
                        <div className="text-2xl font-bold text-primary">
                          {r.score} / {r.totalMarks}
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {r.percentage}% Score
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
