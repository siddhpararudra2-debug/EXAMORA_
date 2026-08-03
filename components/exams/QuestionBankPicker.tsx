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
  if (item.type === "TRUE_FALSE") {
    return {
      type: "TRUE_FALSE",
      questionText: item.question_text,
      marks: item.marks,
      options: ["True", "False"],
      correctAnswer: item.correct_answer === "False" ? "False" : "True",
    };
  }
  if (item.type === "SHORT_ANSWER") {
    return {
      type: "SHORT_ANSWER",
      questionText: item.question_text,
      marks: item.marks,
      options: [],
      correctAnswer: item.correct_answer || "Model answer sample",
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
  onAddQuestions: (questions: BankQuestionFormValue[]) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<BankQuestionItem[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  const add = (item: BankQuestionItem) => {
    onAddQuestions([toFormValue(item)]);
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
            Reuse questions you&apos;ve saved from previous exams. Click Add to
            copy one into this draft.
          </DialogDescription>
        </DialogHeader>

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
