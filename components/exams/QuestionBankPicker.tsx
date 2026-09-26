"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/auth-token";

export interface BankQuestionItem {
  id: string;
  type: string;
  question_text: string;
  options: unknown;
  correct_answer: string | null;
  explanation: string | null;
  marks: number;
}

export interface BankQuestionFormValue {
  type: "MCQ_SINGLE" | "TRUE_FALSE" | "SHORT_ANSWER";
  questionText: string;
  marks: number;
  options: string[];
  correctAnswer: string;
}

const TYPE_LABEL: Record<string, string> = {
  MCQ_SINGLE: "MCQ",
  TRUE_FALSE: "T/F",
  SHORT_ANSWER: "Short",
};

export function toFormValue(item: BankQuestionItem): BankQuestionFormValue {
  const options = Array.isArray(item.options) ? item.options : [];
  // No fabricated answers: missing correct answers stay empty so exam-form
  // validation flags them for the educator instead of silently inventing one.
  if (item.type === "TRUE_FALSE") {
    return {
      type: "TRUE_FALSE",
      questionText: item.question_text,
      marks: item.marks,
      options: ["True", "False"],
      correctAnswer: item.correct_answer || "",
    };
  }
  if (item.type === "SHORT_ANSWER") {
    return {
      type: "SHORT_ANSWER",
      questionText: item.question_text,
      marks: item.marks,
      options: [],
      correctAnswer: item.correct_answer || "",
    };
  }
  return {
    type: "MCQ_SINGLE",
    questionText: item.question_text,
    marks: item.marks,
    options: options.length >= 2 ? options : ["Option A", "Option B"],
    correctAnswer: item.correct_answer || (options[0] as string) || "",
  };
}

export function QuestionBankPicker({
  isOpen,
  onClose,
  onAddQuestions,
}: {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Receives converted form values plus the source bank ids (same order),
   * so hosts editing an existing draft can persist via
   * POST /api/exams/:id/questions/from-bank instead of local append.
   */
  onAddQuestions: (
    questions: BankQuestionFormValue[],
    sourceIds: string[]
  ) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<BankQuestionItem[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/question-bank", {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          data?: { questions?: BankQuestionItem[] };
        };
        setQuestions(payload.data?.questions ?? []);
      }
    } catch {
      // Backend unavailable — empty list.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/v1/question-bank/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      }
    } finally {
      setRemovingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length && questions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const add = (item: BankQuestionItem) => {
    onAddQuestions([toFormValue(item)], [item.id]);
  };

  const addSelected = () => {
    const selected = questions.filter((q) => selectedIds.has(q.id));
    if (selected.length === 0) return;
    onAddQuestions(
      selected.map(toFormValue),
      selected.map((q) => q.id)
    );
    setSelectedIds(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-indigo-600" />
            Your question bank
          </DialogTitle>
          <DialogDescription>
            Reuse questions you&apos;ve saved from previous exams. Select one
            or more and add them — copies, never moves.
          </DialogDescription>
        </DialogHeader>

        {!loading && questions.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              {selectedIds.size === questions.length
                ? "Deselect all"
                : "Select all"}
            </button>
            <Button
              type="button"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={addSelected}
              className="h-9"
            >
              <Plus className="h-4 w-4" /> Add selected ({selectedIds.size})
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your question bank…
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              Nothing saved yet. Use “Save to bank” on any question while
              building an exam.
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(q.id)}
                    onChange={() => toggleSelect(q.id)}
                    aria-label={`Select ${q.question_text.slice(0, 60)}`}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {TYPE_LABEL[q.type] ?? q.type}
                    </Badge>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {q.marks} mark{q.marks === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium text-foreground">
                    {q.question_text}
                  </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 border-border/40"
                    onClick={() => void remove(q.id)}
                    disabled={removingId === q.id}
                    aria-label="Remove from bank"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => add(q)}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QuestionBankPicker;
