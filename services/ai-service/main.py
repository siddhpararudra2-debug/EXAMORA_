from __future__ import annotations

import os

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ai_service import AIQuestionService, AIServiceError
from schemas import (
    ExamGenerationResponse,
    GenerateExamRequest,
    GradeSubjectiveRequest,
    GradeSubjectiveResponse,
)

app = FastAPI(
    title="Examora AI Service",
    description="AI-powered exam question generation and document parsing, backed by Groq (free tier).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_service = AIQuestionService()


@app.exception_handler(AIServiceError)
async def ai_service_error_handler(_request, exc: AIServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "code": exc.code, "message": exc.message},
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "examora-ai",
        "model": ai_service.model,
        "groq_configured": ai_service.available,
    }


@app.post("/api/v1/ai/parse-document", response_model=ExamGenerationResponse)
def parse_document(file: UploadFile = File(..., description="PDF, DOCX or TXT exam paper")) -> ExamGenerationResponse:
    content = file.file.read()
    return ai_service.parse_document(file.filename or "upload", content, file.content_type)


@app.post("/api/v1/ai/generate-exam", response_model=ExamGenerationResponse)
def generate_exam(payload: GenerateExamRequest) -> ExamGenerationResponse:
    return ai_service.generate_exam(payload)


@app.post("/api/v1/ai/grade-subjective", response_model=GradeSubjectiveResponse)
def grade_subjective(payload: GradeSubjectiveRequest) -> GradeSubjectiveResponse:
    return ai_service.grade_subjective(payload)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5001")),
        reload=os.environ.get("ENV") != "production",
    )
