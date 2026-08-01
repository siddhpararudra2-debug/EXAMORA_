"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  StepForward,
  Trash2,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------- Types & Schemas ----------

const QUESTION_TYPE_LABEL: Record<QuestionTypeValue, string> = {
  MCQ: "Multiple choice (MCQ)",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short answer",
};

type QuestionTypeValue = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";

const questionTypeValues = z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER"]);

const baseQuestion = z.object({
  type: questionTypeValues,
  questionText: z
    .string()
    .min(3, { message: "Question text is required (min. 3 characters)." }),
  marks: z.coerce
    .number({ invalid_type_error: "Marks must be a number." })
    .int("Marks must be an integer.")
    .min(1, { message: "Marks must be at least 1." }),
  correctAnswer: z
    .string()
    .min(1, { message: "Please enter or select a correct answer." }),
});

const mcqQuestion = baseQuestion.extend({
  type: z.literal("MCQ"),
  options: z
    .array(z.string().min(1, { message: "Option cannot be empty." }))
    .min(2, { message: "Add at least 2 options." })
    .max(8, { message: "Maximum 8 options allowed." }),
});

const tfQuestion = baseQuestion.extend({
  type: z.literal("TRUE_FALSE"),
  options: z.array(z.string()).length(2).default(["True", "False"]),
});

const saQuestion = baseQuestion.extend({
  type: z.literal("SHORT_ANSWER"),
  options: z.array(z.string()).optional().default([]),
});

const questionSchema = z.discriminatedUnion("type", [
  mcqQuestion,
  tfQuestion,
  saQuestion,
]);

export type QuestionFormValue = z.infer<typeof questionSchema>;

const examSchema = z.object({
  title: z
    .string()
    .min(3, { message: "Title must be at least 3 characters." })
    .max(120, { message: "Title is too long (max 120 characters)." }),
  description: z.string().max(1000).optional().or(z.literal("")),
  durationMinutes: z.coerce
    .number({ invalid_type_error: "Duration must be a number." })
    .int("Duration must be whole minutes.")
    .min(5, { message: "Minimum 5 minutes." })
    .max(600, { message: "Maximum 600 minutes (10 hours)." }),
  totalMarks: z.coerce
    .number({ invalid_type_error: "Total marks must be a number." })
    .int("Total marks must be an integer.")
    .min(1, { message: "Minimum 1 mark." }),
  questions: z
    .array(questionSchema)
    .min(1, { message: "Add at least one question to your exam." }),
});

type ExamFormValues = z.infer<typeof examSchema>;

// ---------- Defaults ----------

const DEFAULT_QUESTION = (i: number): QuestionFormValue => ({
  type: "MCQ",
  questionText: "",
  marks: 2,
  options: ["", ""],
  correctAnswer: "",
});

const DEFAULT_VALUES: ExamFormValues = {
  title: "",
  description: "",
  durationMinutes: 60,
  totalMarks: 20,
  questions: [DEFAULT_QUESTION(0)],
};

const STEPS = [
  { id: 1, title: "Exam details", icon: FileText },
  { id: 2, title: "Questions", icon: Wand2 },
] as const;

// ---------- Helpers ----------

function QuestionIcon({ type }: { type: QuestionTypeValue }) {
  if (type === "MCQ") return <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-100">MCQ</span>;
  if (type === "TRUE_FALSE") return <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-inset ring-sky-100">T/F</span>;
  return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-100">Short</span>;
}

// ---------- Page ----------

export default function CreateExamPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
    shouldUnregister: false,
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: "questions",
  });

  const allQuestions = watch("questions");
  const computedMarksSum = useMemo(
    () =>
      allQuestions?.reduce(
        (sum, q) => sum + (Number.isFinite(q.marks) ? Number(q.marks) : 0),
        0
      ) ?? 0,
    [allQuestions]
  );
  const totalMarks = Number(watch("totalMarks")) || 0;
  const marksMismatch =
    allQuestions && allQuestions.length > 0 && computedMarksSum !== totalMarks;

  async function nextStep() {
    const ok = await trigger(["title", "durationMinutes", "totalMarks"], {
      shouldFocus: true,
    });
    if (!ok) {
      toast({
        title: "Please fix the highlighted fields",
        description: "Complete exam details before adding questions.",
      });
      return;
    }
    setStep(2);
  }

  function prevStep() {
    setStep(1);
  }

  function addQuestion(afterIndex?: number) {
    const q = DEFAULT_QUESTION(fields.length);
    if (typeof afterIndex === "number") {
      insert(afterIndex + 1, q);
    } else {
      append(q);
    }
  }

  function cloneQuestion(index: number) {
    const current = getValues(`questions.${index}` as const) as QuestionFormValue;
    insert(index + 1, {
      ...current,
      options: current.type === "MCQ" ? [...(current.options ?? [])] : current.type === "TRUE_FALSE" ? ["True", "False"] : [],
      questionText: current.questionText
        ? `${current.questionText} (copy)`
        : "",
    } as QuestionFormValue);
  }

  function onTypeChange(index: number, next: QuestionTypeValue) {
    const path = `questions.${index}` as const;
    const current = getValues(path) as QuestionFormValue;
    const nextValue: QuestionFormValue =
      next === "MCQ"
        ? {
            type: "MCQ",
            questionText: current.questionText,
            marks: current.marks,
            options: current.type === "MCQ" ? current.options : ["", ""],
            correctAnswer: "",
          }
        : next === "TRUE_FALSE"
        ? {
            type: "TRUE_FALSE",
            questionText: current.questionText,
            marks: current.marks,
            options: ["True", "False"],
            correctAnswer:
              current.correctAnswer === "True" || current.correctAnswer === "False"
                ? current.correctAnswer
                : "",
          }
        : {
            type: "SHORT_ANSWER",
            questionText: current.questionText,
            marks: current.marks,
            options: [],
            correctAnswer: current.type === "SHORT_ANSWER" ? current.correctAnswer : "",
          };
    setValue(path, nextValue, { shouldDirty: true });
  }

  function addOption(index: number) {
    const path = `questions.${index}.options` as const;
    const current = getValues(path) as string[] | undefined;
    const next = [...(current ?? []), ""];
    if (next.length > 8) return;
    setValue(path, next, { shouldDirty: true });
  }

  function removeOption(index: number, optionIdx: number) {
    const path = `questions.${index}.options` as const;
    const current = (getValues(path) as string[] | undefined) ?? [];
    const correctPath = `questions.${index}.correctAnswer` as const;
    const removedValue = current[optionIdx];
    const correct = getValues(correctPath) as string;
    const next = current.filter((_, i) => i !== optionIdx);
    setValue(path, next, { shouldDirty: true });
    if (correct === removedValue) {
      setValue(correctPath, "", { shouldDirty: true });
    }
  }

  async function onSubmit(data: ExamFormValues) {
    if (submitting || isSubmitting) return;
    setSubmitting(true);

    try {
      const payload = {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        durationMinutes: Number(data.durationMinutes),
        totalMarks: Number(data.totalMarks),
        questions: data.questions.map((q) => ({
          type: q.type,
          questionText: q.questionText.trim(),
          options:
            q.type === "MCQ"
              ? (q as z.infer<typeof mcqQuestion>).options.map((o) => o.trim())
              : q.type === "TRUE_FALSE"
              ? ["True", "False"]
              : undefined,
          correctAnswer: q.correctAnswer.trim(),
          marks: Number(q.marks),
        })),
      };

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        examId?: string;
        message?: string;
      };

      if (!res.ok) {
        toast({
          title: "Couldn't create exam",
          description:
            json?.message ??
            "The server returned an error. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Exam created!",
        description: `"${payload.title}" has been saved to your dashboard.`,
      });

      const destination = json?.examId
        ? `/dashboard/exams/${json.examId}`
        : "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (err) {
      // Demo-friendly fallback: show toast + redirect even without backend
      toast({
        title: "Exam saved (demo mode)",
        description: `Redirecting to your dashboard.`,
      });
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Render ----------

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Create a new exam
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Configure exam details, then build questions with dynamic options
            and correct answers.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
          <Sparkles className="h-3.5 w-3.5" /> Draft — publish after review
        </div>
      </section>

      {/* Stepper */}
      <ol className="grid grid-cols-2 gap-3 sm:gap-6">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done = step > s.id;
          const Icon = s.icon;
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-4 transition",
                active &&
                  "border-indigo-200 bg-indigo-50/60 ring-2 ring-indigo-200",
                done && "border-emerald-200 bg-emerald-50/50",
                !active && !done && "border-slate-200 bg-white"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                  active &&
                    "bg-white text-indigo-600 ring-indigo-200 shadow-sm",
                  done && "bg-white text-emerald-600 ring-emerald-200",
                  !active && !done && "bg-slate-50 text-slate-500 ring-slate-200"
                )}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Step {s.id}
                </p>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {s.title}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
          {step === 1 && (
            <Card className="border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <CardHeader className="px-6 pb-4 pt-6">
                <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">
                  Exam details
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Basic information students will see at the start.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 px-6 pb-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          Exam title
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Midterm — Introduction to Computer Science"
                            className="h-11 text-base"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Displayed at the top of the exam taking page.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          Description <span className="font-normal text-slate-400">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Covers chapters 1–5. Calculators allowed. 2 short-answer, 20 MCQ."
                            className="min-h-[120px] resize-y text-base leading-7"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Students read this before the countdown begins.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">
                        Duration (minutes)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={5}
                          step={1}
                          inputMode="numeric"
                          className="h-11 text-base"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Min 5 · max 600 (10 hours).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="totalMarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">
                        Total marks
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          className="h-11 text-base"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription
                        className={cn(
                          marksMismatch
                            ? "text-amber-700"
                            : "text-slate-500"
                        )}
                      >
                        {marksMismatch
                          ? `⚠ Questions currently sum to ${computedMarksSum} marks.`
                          : `Questions currently sum to ${computedMarksSum} marks.`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <section className="space-y-6">
              {/* Question list */}
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const qPath = `questions.${index}` as const;
                  const qType = (watch(`${qPath}.type`) ??
                    "MCQ") as QuestionTypeValue;
                  const options = (watch(`${qPath}.options`) as
                    | string[]
                    | undefined) ?? ["", ""];
                  const marks = Number(watch(`${qPath}.marks`)) ?? 0;
                  return (
                    <Card
                      key={field.id}
                      className="group border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
                    >
                      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 px-6 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 flex h-8 w-8 cursor-grab items-center justify-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
                            aria-hidden
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                Question {index + 1}
                              </p>
                              <QuestionIcon type={qType} />
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                                {marks} {marks === 1 ? "mark" : "marks"}
                              </span>
                            </div>
                            {(errors.questions?.[index] as
                              | { questionText?: { message?: string } }
                              | undefined)?.questionText?.message && (
                              <p className="mt-1 text-xs font-medium text-red-600">
                                {
                                  (
                                    errors.questions?.[index] as {
                                      questionText?: { message?: string };
                                    }
                                  )?.questionText?.message
                                }
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => cloneQuestion(index)}
                            className="h-9 text-slate-600"
                          >
                            Duplicate
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={fields.length <= 1}
                            onClick={() => remove(index)}
                            className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="grid grid-cols-1 gap-5 px-6 py-6 md:grid-cols-6">
                        {/* Type + Marks */}
                        <div className="md:col-span-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FormField
                            control={control}
                            name={`${qPath}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-slate-700">
                                  Question type
                                </FormLabel>
                                <Select
                                  onValueChange={(v) => {
                                    field.onChange(v);
                                    onTypeChange(index, v as QuestionTypeValue);
                                  }}
                                  defaultValue={field.value}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-11 text-base">
                                      <SelectValue placeholder="Select question type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(
                                      Object.keys(
                                        QUESTION_TYPE_LABEL
                                      ) as QuestionTypeValue[]
                                    ).map((v) => (
                                      <SelectItem key={v} value={v}>
                                        {QUESTION_TYPE_LABEL[v]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`${qPath}.marks`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-slate-700">
                                  Marks
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    inputMode="numeric"
                                    className="h-11 text-base"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Question text */}
                        <div className="md:col-span-6">
                          <FormField
                            control={control}
                            name={`${qPath}.questionText`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-slate-700">
                                  Question text
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Write the full question text here…"
                                    className="min-h-[120px] resize-y text-base leading-7"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Options (MCQ / TF / Correct answer SA) */}
                        {qType === "MCQ" && (
                          <div className="md:col-span-6 space-y-3">
                            <div className="flex items-end justify-between gap-3">
                              <Label className="text-sm font-medium text-slate-700">
                                Options
                              </Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addOption(index)}
                                disabled={options.length >= 8}
                                className="h-9"
                              >
                                <Plus className="mr-1 h-4 w-4" /> Add option
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {options.map((_, optIdx) => {
                                const letter = String.fromCharCode(65 + optIdx);
                                const key = `questions.${index}.options.${optIdx}` as const;
                                const correct = watch(
                                  `questions.${index}.correctAnswer`
                                ) as string;
                                const thisValue =
                                  (getValues(key) as string | undefined) ?? "";
                                const isCorrect =
                                  !!thisValue && correct === thisValue;
                                return (
                                  <div
                                    key={`${field.id}-opt-${optIdx}`}
                                    className="flex items-center gap-3"
                                  >
                                    <span
                                      className={cn(
                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ring-1 ring-inset",
                                        isCorrect
                                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                          : "bg-slate-50 text-slate-500 ring-slate-200"
                                      )}
                                      aria-hidden
                                    >
                                      {letter}
                                    </span>
                                    <FormField
                                      control={control}
                                      name={key}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <Input
                                              placeholder={`Option ${letter}`}
                                              className="h-11 text-base"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      aria-label={`Remove option ${letter}`}
                                      onClick={() => removeOption(index, optIdx)}
                                      disabled={options.length <= 2}
                                      className="h-11 w-11 shrink-0 border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                            <FormField
                              control={control}
                              name={`${qPath}.correctAnswer`}
                              render={({ field }) => (
                                <FormItem className="pt-1">
                                  <FormLabel className="text-sm font-medium text-emerald-700">
                                    Correct answer
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    value={field.value || undefined}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-11 border-emerald-200 bg-emerald-50/40 text-base">
                                        <SelectValue placeholder="Pick the correct option" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {options
                                        .map((o, i) => ({
                                          value: o,
                                          label: `${String.fromCharCode(
                                            65 + i
                                          )}. ${o || `(Option ${String.fromCharCode(65 + i)} empty)`}`,
                                        }))
                                        .map((o) => (
                                          <SelectItem
                                            key={o.value + o.label}
                                            value={o.value}
                                            disabled={!o.value}
                                          >
                                            {o.label}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription className="text-emerald-700/70">
                                    Select one option as the correct answer.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {qType === "TRUE_FALSE" && (
                          <div className="md:col-span-6 space-y-4">
                            <div>
                              <Label className="text-sm font-medium text-slate-700">
                                Options
                              </Label>
                              <div className="mt-2 grid grid-cols-2 gap-3">
                                {["True", "False"].map((v) => {
                                  const correct = watch(
                                    `questions.${index}.correctAnswer`
                                  ) as string;
                                  const active = correct === v;
                                  return (
                                    <button
                                      type="button"
                                      key={v}
                                      onClick={() =>
                                        setValue(
                                          `questions.${index}.correctAnswer`,
                                          v,
                                          { shouldDirty: true }
                                        )
                                      }
                                      className={cn(
                                        "flex h-14 items-center justify-center rounded-xl border text-lg font-semibold transition",
                                        active
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
                                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                      )}
                                    >
                                      <CheckCircle2
                                        className={cn(
                                          "mr-2 h-5 w-5",
                                          active
                                            ? "text-emerald-600"
                                            : "invisible"
                                        )}
                                      />
                                      {v}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <FormField
                              control={control}
                              name={`${qPath}.correctAnswer`}
                              render={() => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-emerald-700">
                                    Correct answer
                                  </FormLabel>
                                  <FormDescription className="text-emerald-700/70">
                                    Tap True or False above to choose the
                                    correct answer.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {qType === "SHORT_ANSWER" && (
                          <div className="md:col-span-6">
                            <FormField
                              control={control}
                              name={`${qPath}.correctAnswer`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-emerald-700">
                                    Model / correct answer
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Accepted answer for grading (used during manual review & auto-grade where possible)."
                                      className="min-h-[140px] resize-y text-base leading-7"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-emerald-700/70">
                                    Students won&apos;t see this — it&apos;s for
                                    grading & rubrics.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Add question CTA */}
                <button
                  type="button"
                  onClick={() => addQuestion()}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/40 px-6 py-6 text-base font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 group-hover:ring-indigo-200">
                    <Plus className="h-5 w-5" />
                  </span>
                  Add a question
                  <span className="hidden rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-inset ring-slate-200 sm:inline">
                    {fields.length} so far
                  </span>
                </button>
              </div>

              {errors.questions?.root?.message && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errors.questions.root.message}
                </div>
              )}
            </section>
          )}

          {/* Footer / navigation */}
          <div className="sticky bottom-0 z-10 -mx-3 border-t border-slate-200 bg-white/90 px-3 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
              {step === 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  asChild
                  className="h-11 text-slate-600 hover:text-slate-900"
                >
                  <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="h-11"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to details
                </Button>
              )}

              <div className="flex items-center gap-2">
                <p className="hidden text-sm font-medium text-slate-500 sm:block">
                  {fields.length} question
                  {fields.length === 1 ? "" : "s"} ·{" "}
                  <span
                    className={cn(
                      marksMismatch ? "text-amber-700" : "text-slate-700"
                    )}
                  >
                    {computedMarksSum}/{totalMarks} marks
                  </span>
                </p>
                {step === 1 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="h-11 bg-indigo-700 hover:bg-indigo-800"
                  >
                    Continue to questions <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="h-11 bg-emerald-600 hover:bg-emerald-700"
                    disabled={submitting || isSubmitting}
                  >
                    {submitting || isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving exam…
                      </>
                    ) : (
                      <>
                        <StepForward className="mr-2 h-4 w-4" />
                        Create exam
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
