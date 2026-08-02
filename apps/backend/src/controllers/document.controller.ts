import { Request, Response, NextFunction } from "express";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // must match the AI service limit
const UPSTREAM_TIMEOUT_MS = 60_000;

/**
 * Resolves the FastAPI AI service base URL. Inside Docker Compose this is
 * `http://ai-service:5001`; locally it defaults to `http://localhost:5001`.
 */
function aiServiceBaseUrl(): string {
  return (process.env.AI_SERVICE_URL || "http://localhost:5001").replace(/\/+$/, "");
}

/**
 * POST /api/exams/parse-document
 * Proxies a PDF/DOCX/TXT exam-paper upload to the FastAPI AI service
 * (services/ai-service), which extracts structured questions via Groq.
 *
 * The upload arrives as multipart/form-data (multer, field "file") and is
 * re-sent to the upstream as FormData — same-origin for the frontend,
 * teacher JWT already verified by the route middleware.
 */
export const parseDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      res.status(400).json({
        status: "error",
        message: "A file is required (multipart field 'file').",
      });
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      res.status(413).json({
        status: "error",
        message: "File exceeds the 10 MB limit.",
      });
      return;
    }

    const baseUrl = aiServiceBaseUrl();

    let upstream: globalThis.Response;
    try {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(file.buffer)], {
          type: file.mimetype || "application/octet-stream",
        }),
        file.originalname
      );

      upstream = await fetch(`${baseUrl}/api/v1/ai/parse-document`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      console.warn("[DocumentParser] AI service unreachable:", err);
      res.status(503).json({
        status: "error",
        code: "ai_service_unavailable",
        message:
          "The AI document service is not running. Start it with `npm run ai:service` or `docker compose up -d ai-service`.",
      });
      return;
    }

    const json = (await upstream.json().catch(() => ({}))) as {
      status?: string;
      code?: string;
      message?: string;
      data?: unknown;
    };

    if (!upstream.ok) {
      res.status(upstream.status).json({
        status: "error",
        code: json.code || "ai_service_error",
        message: json.message || "The AI service could not parse this document.",
      });
      return;
    }

    res.json({ status: "success", data: json });
  } catch (err) {
    next(err);
  }
};
