"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/auth-token";
import { cn } from "@/lib/utils";

export interface ReviewAnswer {
  question_id: string;
  answer_text: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  needs_review: boolean;
  graded_by?: string | null;
  ai_suggested_score?: number | null;
  ai_rationale?: string | null;
  final_score?: number | null;
  grading_note?: string | null;
}

export interface ReviewQuestion {
  id: string;
  question_text: string;
  type: string;
  marks: number;
}

interface SessionAnswerReviewProps {
  examId: string;
  sessionId: string;
  questions: ReviewQuestion[];
  answers: ReviewAnswer[];
  onSaved: () => void;
}

/**
 * P2-6 educator review panel: per-answer AI suggestion + rationale with an
 * editable override. Effective score everywhere is
 * final_score ?? marks_awarded (marks_awarded holds the auto/AI score).
 */
export function SessionAnswerReview({
  examId,
  sessionId,
  questions,
  answers,
  onSaved,
}: SessionAnswerReviewProps) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const saveOverride = async (question: ReviewQuestion, answer: ReviewAnswer) => {
    const rawScore = scores[question.id];
    if (rawScore === undefined || rawScore === "") return;
    const finalScore = Number(rawScore);
    if (!Number.isFinite(finalScore) || finalScore < 0 || finalScore > question.marks) {
      toast({
        title: "Invalid score",
        description: `Enter a number between 0 and ${question.marks}.`,
        variant: "destructive",
      });
      return;
    }
    setSavingId(question.id);
    try {
      const res = await fetch(
        `/api/exams/${examId}/sessions/${sessionId}/answers/${question.id}/grade`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          body: JSON.stringify({
            finalScore,
            gradingNote: notes[question.id]?.trim() || undefined,
          }),
        }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        toast({
          title: "Couldn't save override",
          description: payload?.message ?? "The server returned an error.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Override saved",
        description: "The scorecard totals were recomputed.",
      });
      onSaved();
    } catch {
      toast({
        title: "Couldn't save override",
        description: "The server could not be reached.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {questions.map((question, idx) => {
        const answer = answers.find((a) => a.question_id === question.id);
        if (!answer) return null;
        const effective =
          answer.final_score ?? answer.marks_awarded ?? null;
        const hasAiSuggestion = answer.ai_suggested_score !== null &&
          answer.ai_suggested_score !== undefined;
        const overridden =
          answer.final_score !== null && answer.final_score !== undefined;
        return (
          <div
            key={question.id}
            className="rounded-xl border border-border/60 bg-background p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold text-muted-foreground">
                Q{idx + 1} · {question.type} · {question.marks}{" "}
                {question.marks === 1 ? "mark" : "marks"}
              </p>
              {answer.needs_review && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  <ShieldAlert className="h-3 w-3" />
                  Needs review
                </span>
              )}
              {overridden && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Educator override
                </span>
              )}
              <span className="ml-auto text-sm font-bold text-foreground">
                {effective !== null ? `${effective} / ${question.marks}` : "Not scored"}
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold text-foreground">
              {question.question_text}
            </p>
            {answer.answer_text && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {answer.answer_text}
              </p>
            )}

            {hasAiSuggestion && (
              <div className="mt-3 rounded-lg border border-violet-200/70 bg-violet-50/50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-violet-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI suggestion: {answer.ai_suggested_score} / {question.marks}
                  {answer.graded_by ? ` · graded by ${answer.graded_by}` : ""}
                </p>
                {answer.ai_rationale && (
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-violet-900/80">
                    {answer.ai_rationale}
                  </p>
                )}
              </div>
            )}

            {answer.grading_note && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Note: </span>
                {answer.grading_note}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                Override score
                <Input
                  type="number"
                  min={0}
                  max={question.marks}
                  step={0.5}
                  value={scores[question.id] ?? ""}
                  onChange={(e) =>
                    setScores((prev) => ({
                      ...prev,
                      [question.id]: e.target.value,
                    }))
                  }
                  placeholder={effective !== null ? String(effective) : "0"}
                  aria-label={`Override score for question ${idx + 1}`}
                  className="h-9 w-24"
                />
                <span className="font-normal">/ {question.marks}</span>
              </label>
              <Textarea
                value={notes[question.id] ?? ""}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [question.id]: e.target.value }))
                }
                placeholder="Grading note (optional)"
                aria-label={`Grading note for question ${idx + 1}`}
                className="min-h-[36px] flex-1 text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={savingId === question.id || scores[question.id] === undefined || scores[question.id] === ""}
                onClick={() => void saveOverride(question, answer)}
                className="h-9 shrink-0"
              >
                {savingId === question.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save override"
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SessionAnswerReview;
