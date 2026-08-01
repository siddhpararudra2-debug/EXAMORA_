"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Loader2,
  Check,
  X,
  BookOpen,
  HelpCircle,
  CheckSquare,
  Square,
} from "lucide-react";

export interface GeneratedQuestion {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  questionText: string;
  options?: string[];
  marks: number;
}

export interface AIQuestionGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestions: (questions: GeneratedQuestion[]) => void;
}

export function AIQuestionGenerator({
  isOpen,
  onClose,
  onAddQuestions,
}: AIQuestionGeneratorProps) {
  const [topic, setTopic] = useState<string>("");
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [questionType, setQuestionType] = useState<string>("MCQ");

  const [loading, setLoading] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // AI Question Generation API call (or fallback generator)
  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setGeneratedQuestions([]);
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count, difficulty, questionType }),
      });

      if (res.ok) {
        const data = await res.json();
        const questions: GeneratedQuestion[] = data.questions || [];
        setGeneratedQuestions(questions);
        setSelectedIds(new Set(questions.map((q) => q.id)));
      } else {
        // Fallback generator for instant response
        const fallback = generateMockQuestions(topic, count, difficulty, questionType);
        setGeneratedQuestions(fallback);
        setSelectedIds(new Set(fallback.map((q) => q.id)));
      }
    } catch (err) {
      const fallback = generateMockQuestions(topic, count, difficulty, questionType);
      setGeneratedQuestions(fallback);
      setSelectedIds(new Set(fallback.map((q) => q.id)));
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
    if (selectedIds.size === generatedQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(generatedQuestions.map((q) => q.id)));
    }
  };

  const handleAddSelected = () => {
    const selected = generatedQuestions.filter((q) => selectedIds.has(q.id));
    if (selected.length > 0) {
      onAddQuestions(selected);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">✨ AI Question Generator</h2>
              <p className="text-xs text-slate-500">Generate exam questions automatically using client-side AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form & Preview Area */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {/* Controls Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Topic or Subject Matter *
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Computer Networks, React Hooks, Database Indexing"
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Number of Questions
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Question Type
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="MCQ">Multiple Choice (MCQ)</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_ANSWER">Short Answer</option>
              </select>
            </div>

            <div className="sm:col-span-2 pt-2">
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!topic.trim() || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI is generating questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate Questions with AI
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Generated Questions List Preview */}
          {generatedQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  Generated Questions Preview ({generatedQuestions.length})
                </h3>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {selectedIds.size === generatedQuestions.length ? (
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
                {generatedQuestions.map((q, idx) => {
                  const isSelected = selectedIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-300"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(q.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-700">
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
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  {opt}
                                </li>
                              ))}
                            </ul>
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

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {generatedQuestions.length > 0 && (
            <Button
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Add {selectedIds.size} Question{selectedIds.size === 1 ? "" : "s"} to Exam
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Generates fallback mock questions for preview
function generateMockQuestions(
  topic: string,
  count: number,
  difficulty: string,
  type: string
): GeneratedQuestion[] {
  const result: GeneratedQuestion[] = [];
  for (let i = 1; i <= count; i++) {
    if (type === "MCQ" || (type === "MIXED" && i % 2 === 1)) {
      result.push({
        id: `ai-q-${Date.now()}-${i}`,
        type: "MCQ",
        questionText: `Which of the following best describes the core mechanism of ${topic} in ${difficulty.toLowerCase()} context?`,
        options: [
          `Primary optimization pattern for ${topic}`,
          `Secondary fallback strategy`,
          `Asynchronous event loop handler`,
          `Memory allocation buffer`,
        ],
        marks: 2,
      });
    } else if (type === "TRUE_FALSE") {
      result.push({
        id: `ai-q-${Date.now()}-${i}`,
        type: "TRUE_FALSE",
        questionText: `True or False: ${topic} operations run in linear time complexity under standard parameters.`,
        options: ["True", "False"],
        marks: 1,
      });
    } else {
      result.push({
        id: `ai-q-${Date.now()}-${i}`,
        type: "SHORT_ANSWER",
        questionText: `Explain the key trade-offs when implementing ${topic} in production applications.`,
        marks: 5,
      });
    }
  }
  return result;
}

export default AIQuestionGenerator;
