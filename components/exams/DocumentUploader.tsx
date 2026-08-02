"use client";

import React, { useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckSquare,
  FileText,
  Loader2,
  Square,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/auth-token";
import { GeneratedQuestion } from "@/components/exams/AIQuestionGenerator";

export interface DocumentUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestions: (questions: GeneratedQuestion[]) => void;
}

/** A single question as returned by the FastAPI AI service (snake_case). */
export interface ParsedDocumentQuestion {
  id: string;
  question_text: string;
  type: string;
  options?: string[];
  correct_answer?: string | null;
  explanation?: string;
  marks?: number;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

/**
 * Normalizes a parsed document question into the exam wizard's GeneratedQuestion
 * shape. The wizard only supports MCQ_SINGLE / TRUE_FALSE / SHORT_ANSWER, so
 * multi-select, fill-blank, dropdown and long-answer types are mapped onto the
 * closest supported type.
 */
function toGeneratedQuestion(q: ParsedDocumentQuestion): GeneratedQuestion {
  const rawOptions = (q.options ?? []).filter((o) => typeof o === "string" && o.trim().length > 0);

  let type: GeneratedQuestion["type"];
  let options: string[] | undefined;
  let correctAnswer = (q.correct_answer ?? "").trim();

  switch (q.type) {
    case "mcq_single":
    case "dropdown":
    case "mcq_multi":
      type = "MCQ_SINGLE";
      options = rawOptions.length >= 2 ? rawOptions : undefined;
      if (q.type === "mcq_multi" && correctAnswer) {
        correctAnswer = correctAnswer.split(/[;,|]/)[0]?.trim() ?? correctAnswer;
      }
      break;
    case "true_false":
      type = "TRUE_FALSE";
      options = ["True", "False"];
      if (correctAnswer) {
        correctAnswer = /^t/i.test(correctAnswer) ? "True" : "False";
      }
      break;
    default:
      type = "SHORT_ANSWER";
      options = [];
  }

  if (type === "MCQ_SINGLE") {
    if (options && options.length >= 2 && !options.includes(correctAnswer)) {
      correctAnswer = options[0];
    }
    if (!options || options.length < 2) {
      options = ["Option A", "Option B"];
      correctAnswer = correctAnswer || options[0];
    }
  }

  return {
    id: q.id,
    type,
    questionText: q.question_text,
    options,
    correctAnswer: correctAnswer || undefined,
    marks: Math.max(1, Math.round(q.marks ?? 2) || 2),
  };
}

export function DocumentUploader({
  isOpen,
  onClose,
  onAddQuestions,
}: DocumentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const reset = () => {
    setFileName(null);
    setError(null);
    setParsedQuestions([]);
    setSelectedIds(new Set());
  };

  const handleFileSelected = (file: File | undefined | null) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (!ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
      setError("Unsupported file type. Please upload a PDF, DOCX, TXT or MD file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds the 10 MB limit.");
      return;
    }
    setError(null);
    setFileName(file.name);
    void uploadDocument(file);
  };

  const uploadDocument = async (file: File) => {
    setLoading(true);
    setParsedQuestions([]);
    setSelectedIds(new Set());

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/exams/parse-document", {
        method: "POST",
        headers: { ...authHeaders() },
        credentials: "include",
        body: form,
      });

      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        code?: string;
        message?: string;
        data?: {
          questions?: ParsedDocumentQuestion[];
        };
        questions?: ParsedDocumentQuestion[];
      };

      if (!res.ok) {
        setError(
          json?.message ??
            (res.status === 503
              ? "The AI document service is not running. Ask your administrator to start it."
              : "The AI service could not parse this document.")
        );
        return;
      }

      const raw = json.data?.questions ?? json?.questions ?? [];
      const questions = raw.map(toGeneratedQuestion);

      if (questions.length === 0) {
        setError("No questions were identified in this document.");
        return;
      }

      setParsedQuestions(questions);
      setSelectedIds(new Set(questions.map((q) => q.id)));
    } catch {
      setError(
        "Upload failed. Check that the AI document service is running, then try again."
      );
    } finally {
      setLoading(false);
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
    if (selectedIds.size === parsedQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedQuestions.map((q) => q.id)));
    }
  };

  const handleAddSelected = () => {
    const selected = parsedQuestions.filter((q) => selectedIds.has(q.id));
    if (selected.length > 0) {
      onAddQuestions(selected);
      reset();
      onClose();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Upload exam paper</h2>
              <p className="text-xs text-slate-500">
                AI extracts questions from a PDF, DOCX or TXT exam paper
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelected(e.dataTransfer.files?.[0]);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
            <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {fileName ? (
                <>
                  <span className="text-emerald-700">{fileName}</span> — click to
                  choose another
                </>
              ) : (
                "Click to choose a file or drop it here"
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              PDF · DOCX · TXT · MD — max 10 MB (scanned PDFs are OCR&apos;d)
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              AI is reading the paper and extracting questions…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Parsed questions preview */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                  Extracted Questions ({parsedQuestions.length})
                </h3>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  {selectedIds.size === parsedQuestions.length ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5" /> Select All
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {parsedQuestions.map((q, idx) => {
                  const isSelected = selectedIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-300"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(q.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-emerald-700">
                              Q{idx + 1}. [{q.type}]
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {q.marks} Marks
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 leading-relaxed">
                            {q.questionText}
                          </p>
                          {q.options && q.options.length > 0 && (
                            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 pl-2">
                              {q.options.map((opt, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      opt === q.correctAnswer
                                        ? "bg-emerald-500"
                                        : "bg-slate-400"
                                    }`}
                                  />
                                  {opt}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.type === "SHORT_ANSWER" && q.correctAnswer && (
                            <p className="mt-1.5 text-xs text-slate-500">
                              <span className="font-semibold text-emerald-700">
                                Model answer:
                              </span>{" "}
                              {q.correctAnswer.length > 120
                                ? `${q.correctAnswer.slice(0, 120)}…`
                                : q.correctAnswer}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {parsedQuestions.length > 0 && (
            <Button
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Add {selectedIds.size} Question{selectedIds.size === 1 ? "" : "s"} to Exam
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentUploader;
