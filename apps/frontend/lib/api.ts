import { authHeaders } from "@/lib/auth-token";

export interface ProctoringEvent {
  id: string;
  sessionId: string;
  type: string;
  description?: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

export interface InviteSummary {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
}

export interface Question {
  id: string;
  type:
    | "MCQ_SINGLE"
    | "MCQ_MULTI"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "LONG_ANSWER"
    | "FILL_BLANK";
  questionText: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Fetches all proctoring events for a specific student exam session.
 */
export async function getProctoringEvents(
  examId: string,
  sessionId: string
): Promise<ProctoringEvent[]> {
  try {
    const res = await fetch(
      `${API_BASE}/exams/${examId}/sessions/${sessionId}/events`,
      {
        headers: {
          ...authHeaders(),
        },
        credentials: "include",
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch proctoring events (${res.status})`);
    }

    const data = await res.json();
    return data.data?.events || data.events || [];
  } catch (err) {
    console.warn("[API] getProctoringEvents fetch error:", err);
    return [];
  }
}

/**
 * Uploads a CSV file of candidate emails to bulk register and email session tokens.
 */
export async function bulkInviteStudents(
  examId: string,
  csvFile: File
): Promise<InviteSummary> {
  const formData = new FormData();
  formData.append("file", csvFile);

  const res = await fetch(`${API_BASE}/exams/${examId}/invite-bulk`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || `Bulk invite failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Calls the Groq-powered AI endpoint to generate exam questions.
 */
export async function generateQuestions(
  topic: string,
  count: number = 5,
  difficulty: string = "medium",
  type: string = "MCQ_SINGLE"
): Promise<Question[]> {
  const res = await fetch(`${API_BASE}/exams/generate-questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({ topic, count, difficulty, type }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || `Question generation failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.questions || data.data?.questions || [];
}
