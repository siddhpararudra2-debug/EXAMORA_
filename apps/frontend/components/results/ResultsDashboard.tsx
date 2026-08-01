"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Eye,
  GraduationCap,
  Loader2,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoreDistributionChart, scoreToBucketIndex } from "./ScoreDistributionChart";

export interface AnswerSheetRow {
  questionNumber: number;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
}

export interface StudentResult {
  id: string;
  rank: number;
  studentName: string;
  enrollmentNumber: string;
  email?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: "Pass" | "Fail";
  answers: AnswerSheetRow[];
}

export interface ResultsDashboardProps {
  examId: string;
  examTitle?: string;
  /** Pass threshold as a percentage. Default: 40 */
  passPercentage?: number;
  /** API base URL. Default: /api */
  apiBase?: string;
  /** Rows per page in the results table. Default: 8 */
  pageSize?: number;
}

type SortKey = "rank" | "studentName" | "enrollmentNumber" | "score" | "percentage" | "status";
type SortDir = "asc" | "desc";

const PASS_PERCENTAGE_DEFAULT = 40;
const PAGE_SIZE_DEFAULT = 8;
const API_BASE_DEFAULT = "/api";

/* ------------------------------------------------------------------ */
/* Mock data (used until the results API is reachable)                 */
/* ------------------------------------------------------------------ */

const MOCK_NAMES = [
  "Aarav Mehta", "Priya Sharma", "Rohan Verma", "Sneha Kulkarni", "Aditya Rao",
  "Ishita Banerjee", "Vikram Singh", "Ananya Reddy", "Kabir Malhotra", "Divya Nair",
  "Arjun Iyer", "Meera Krishnan", "Yash Thakur", "Nisha Pillai", "Dev Patel",
  "Kavya Joshi", "Rahul Nair", "Tanvi Desai", "Siddharth Kapoor", "Aisha Khan",
  "Manav Gupta", "Ritika Sood", "Harsh Vora", "Lakshmi Menon",
];

/** Deterministic PRNG so mock renders are stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMockAnswers(studentIndex: number, totalMarks: number): AnswerSheetRow[] {
  const rowCount = Math.max(5, Math.min(10, Math.round(totalMarks / 3)));
  return Array.from({ length: rowCount }, (_, i) => {
    const marks = i % 3 === 0 ? 5 : 2;
    const roll = mulberry32(studentIndex * 100 + i)();
    return {
      questionNumber: i + 1,
      questionText: `Sample question ${i + 1} covering core ${["concepts", "algorithms", "case study", "definitions", "applications"][i % 5]}`,
      studentAnswer: roll > 0.7 ? "Skipped" : `Answer text for question ${i + 1}`,
      correctAnswer: `Answer text for question ${i + 1}`,
      marks,
      marksAwarded: roll > 0.7 ? 0 : roll > 0.25 ? marks : Math.round(marks / 2),
      isCorrect: roll <= 0.25,
    };
  });
}

function generateMockResults(count = 24): StudentResult[] {
  const random = mulberry32(42);
  const totalMarks = 100;

  const results = MOCK_NAMES.slice(0, count).map((studentName, index) => {
    // Weighted score: mostly mid-range, some top scores, a tail of low scores.
    const roll = random();
    const percentage =
      roll < 0.12 ? 12 + random() * 18 : roll < 0.28 ? 42 + random() * 18 : roll < 0.6 ? 62 + random() * 18 : 82 + random() * 17;
    const score = Math.round((percentage / 100) * totalMarks);
    const studentEmail = `${studentName.toLowerCase().replace(/[^a-z]+/g, ".")}@student.edu`;

    return {
      id: `session-${index + 1}`,
      rank: 0,
      studentName,
      enrollmentNumber: `CS2023-${String(1000 + index * 37).padStart(4, "0")}`,
      email: studentEmail,
      score,
      totalMarks,
      percentage: Math.round(percentage * 10) / 10,
      status: (percentage >= PASS_PERCENTAGE_DEFAULT ? "Pass" : "Fail") as "Pass" | "Fail",
      answers: generateMockAnswers(index, totalMarks),
    };
  });

  // Rank by descending score (ties broken by name).
  const ranked = [...results].sort(
    (a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName),
  );
  ranked.forEach((result, index) => {
    result.rank = index + 1;
  });
  return ranked;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

const SORT_LABELS: Record<SortKey, string> = {
  rank: "Rank",
  studentName: "Student Name",
  enrollmentNumber: "Enrollment",
  score: "Score",
  percentage: "Percentage",
  status: "Status",
};

export function ResultsDashboard({
  examId,
  examTitle,
  passPercentage = PASS_PERCENTAGE_DEFAULT,
  apiBase = API_BASE_DEFAULT,
  pageSize = PAGE_SIZE_DEFAULT,
}: ResultsDashboardProps) {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const [declaring, setDeclaring] = useState(false);
  const [declared, setDeclared] = useState(false);

  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);

  /* ---------------- Data loading with mock fallback ---------------- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadFromApi = async (): Promise<StudentResult[] | null> => {
      try {
        const res = await fetch(`${apiBase}/exams/${examId}/results`, { credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();

        // API shape: { data: { exam, questions[], results[] } }
        const payload = (data?.data ?? data) as {
          results?: unknown;
          questions?: unknown;
        };
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(payload.results)
            ? payload.results
            : Array.isArray(payload)
              ? payload
              : [];
        if (!Array.isArray(list)) return null;

        const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
        const questions = rawQuestions.filter(
          (q): q is Record<string, unknown> => Boolean(q) && typeof q === "object",
        );
        const questionById = new Map(questions.map((q) => [String(q.id), q]));
        const totalMarks =
          questions.reduce((sum, q) => sum + Number(q.marks ?? 0), 0) || 100;

        return (list as unknown[])
          .filter((row): row is Record<string, unknown> => Boolean(row))
          .map((row, index) => {
            const rawAnswers = Array.isArray(row.answers) ? row.answers : [];
            const percentage = Number(row.percentage ?? row.total_score ?? 0);
            const answers: AnswerSheetRow[] = rawAnswers
              .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object")
              .map((answer) => {
                const question = questionById.get(String(answer.question_id));
                return {
                  questionNumber: Number(question?.order_index ?? 0) + 1,
                  questionText: String(question?.question_text ?? "Question"),
                  studentAnswer: String(answer.answer_text ?? ""),
                  correctAnswer: String(question?.correct_answer ?? ""),
                  marks: Number(question?.marks ?? 0),
                  marksAwarded: Number(answer.marks_awarded ?? 0),
                  isCorrect: answer.is_correct === true,
                };
              });

            return {
              id: String(row.id ?? `row-${index}`),
              rank: Number(row.rank ?? index + 1),
              studentName: String(row.studentName ?? row.student_name ?? "Unknown"),
              enrollmentNumber: String(row.enrollmentNumber ?? row.enrollment_number ?? "—"),
              email: row.email ? String(row.email) : undefined,
              score: Number(row.totalScore ?? row.score ?? row.total_score ?? 0),
              totalMarks,
              percentage,
              status: (percentage >= passPercentage ? "Pass" : "Fail") as "Pass" | "Fail",
              answers,
            };
          });
      } catch {
        return null;
      }
    };

    void loadFromApi().then((apiResults) => {
      if (cancelled) return;
      if (apiResults) {
        setResults(apiResults);
        setUsingMockData(false);
      } else {
        setResults(generateMockResults());
        setUsingMockData(true);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [examId, apiBase, passPercentage]);

  /* ---------------- Derived analytics ---------------- */
  const analytics = useMemo(() => {
    if (results.length === 0) {
      return { max: 0, min: 0, average: 0, passRate: 0 };
    }
    const percentages = results.map((result) => result.percentage);
    const max = Math.max(...percentages);
    const min = Math.min(...percentages);
    const average = percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
    const passRate = (results.filter((result) => result.status === "Pass").length / results.length) * 100;
    return { max, min, average, passRate };
  }, [results]);

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    results.forEach((result) => {
      buckets[scoreToBucketIndex(result.percentage)] += 1;
    });
    return buckets;
  }, [results]);

  /* ---------------- Sorting & pagination ---------------- */
  const sortedResults = useMemo(() => {
    const sorted = [...results];
    sorted.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      if (sortKey === "rank" || sortKey === "score" || sortKey === "percentage") {
        return (a[sortKey] - b[sortKey]) * direction;
      }
      if (sortKey === "status") {
        return a.status.localeCompare(b.status) * direction;
      }
      return a[sortKey].localeCompare(b[sortKey]) * direction;
    });
    return sorted;
  }, [results, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sortedResults.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ---------------- Declare results ---------------- */
  const handleDeclareResults = useCallback(async () => {
    setDeclaring(true);
    try {
      const res = await fetch(`${apiBase}/v1/exams/${examId}/declare-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.message || `Declare results failed with status ${res.status}`);
      }
      setDeclared(true);
      toast({
        title: "Results Declared",
        description: "Marksheets are being emailed to all students.",
      });
    } catch (err) {
      toast({
        title: "Failed to Declare Results",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeclaring(false);
    }
  }, [examId, apiBase]);

  const stats = [
    {
      label: "Class Maximum",
      value: `${analytics.max.toFixed(1)}%`,
      icon: Trophy,
      iconClass: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Class Minimum",
      value: `${analytics.min.toFixed(1)}%`,
      icon: TrendingDown,
      iconClass: "bg-red-100 text-red-600",
    },
    {
      label: "Class Average",
      value: `${analytics.average.toFixed(1)}%`,
      icon: TrendingUp,
      iconClass: "bg-indigo-100 text-indigo-600",
    },
    {
      label: "Pass Rate",
      value: `${analytics.passRate.toFixed(1)}%`,
      icon: GraduationCap,
      iconClass: "bg-amber-100 text-amber-700",
    },
  ];

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
    active ? dir === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-600" /> : null;

  return (
    <div className="w-full space-y-6">
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Results &amp; Analytics</h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
            <span>
              {examTitle ? `${examTitle} · ` : ""}
              {results.length} students evaluated
            </span>
            {usingMockData && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">Demo data</Badge>
            )}
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleDeclareResults}
          disabled={declaring || declared || loading}
          className="gap-2"
        >
          {declaring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {declaring ? "Declaring…" : declared ? "Results Declared" : "Declare Results"}
        </Button>
      </div>

      {/* ---------------- Analytics cards ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.iconClass}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">{loading ? "—" : stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------- Score distribution ---------------- */}
      <ScoreDistributionChart distribution={loading ? undefined : distribution} />

      {/* ---------------- Results table ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Student Results</h3>
            <p className="mt-0.5 text-xs text-slate-500">Click a column header to sort. Select a row to view the answer sheet.</p>
          </div>
          <Badge variant="secondary">{results.length} students</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <th key={key} className="px-6 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-indigo-600"
                      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      {SORT_LABELS[key]}
                      <SortIcon active={sortKey === key} dir={sortDir} />
                    </button>
                  </th>
                ))}
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Loading results…</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">No results yet.</td>
                </tr>
              ) : (
                pageRows.map((result) => (
                  <tr key={result.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                        {result.rank}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">{result.studentName}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{result.enrollmentNumber}</td>
                    <td className="px-6 py-3.5 text-slate-700">
                      <span className="font-semibold">{result.score}</span>
                      <span className="text-xs text-slate-400"> / {result.totalMarks}</span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{result.percentage.toFixed(1)}%</td>
                    <td className="px-6 py-3.5">
                      <Badge
                        className={
                          result.status === "Pass"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-red-100 text-red-700 hover:bg-red-100"
                        }
                      >
                        {result.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setSelectedResult(result)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Actions
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ---------------- Pagination ---------------- */}
        {!loading && results.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-3.5">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sortedResults.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{sortedResults.length}</span> students
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={`h-8 w-8 rounded-md text-xs font-semibold transition-colors ${
                    i === currentPage ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-current={i === currentPage ? "page" : undefined}
                >
                  {i + 1}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Answer sheet modal ---------------- */}
      <Dialog open={Boolean(selectedResult)} onOpenChange={(open) => { if (!open) setSelectedResult(null); }}>
        <DialogContent className="max-w-2xl">
          {selectedResult && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  Answer Sheet — {selectedResult.studentName}
                </DialogTitle>
                <DialogDescription>
                  {selectedResult.enrollmentNumber} · Rank #{selectedResult.rank} · {selectedResult.score}/{selectedResult.totalMarks} ({selectedResult.percentage.toFixed(1)}%)
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">#</th>
                      <th className="px-4 py-2.5 font-semibold">Question</th>
                      <th className="px-4 py-2.5 font-semibold">Student Answer</th>
                      <th className="px-4 py-2.5 font-semibold">Correct Answer</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedResult.answers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No answer data available for this student yet.
                        </td>
                      </tr>
                    ) : (
                      selectedResult.answers.map((answer) => (
                        <tr key={answer.questionNumber} className="border-t border-slate-100">
                          <td className="px-4 py-2.5 text-slate-500">{answer.questionNumber}</td>
                          <td className="max-w-[180px] truncate px-4 py-2.5 text-slate-700">{answer.questionText}</td>
                          <td className={`px-4 py-2.5 ${answer.isCorrect ? "text-emerald-700" : "text-red-600"}`}>
                            {answer.studentAnswer}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{answer.correctAnswer}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                            {answer.marksAwarded}/{answer.marks}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ResultsDashboard;
