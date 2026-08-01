from __future__ import annotations

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

META_OPTION_PATTERNS = (
    "all of the above",
    "none of the above",
    "all of these",
    "none of these",
    "all the above",
    "all the below",
    "all are correct",
    "none are correct",
    "all options are correct",
    "no options are correct",
    "both a and b",
    "neither a nor b",
)


class QuestionType(str, Enum):
    MCQ_SINGLE = "mcq_single"
    MCQ_MULTI = "mcq_multi"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    FILL_BLANK = "fill_blank"
    DROPDOWN = "dropdown"
    LINEAR_SCALE = "linear_scale"
    CHECKBOX_GRID = "checkbox_grid"
    RADIO_GRID = "radio_grid"
    DATE = "date"
    FILE_UPLOAD = "file_upload"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    MIXED = "mixed"


class BloomsLevel(str, Enum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"


SINGLE_CHOICE_TYPES = frozenset(
    {
        QuestionType.MCQ_SINGLE,
        QuestionType.MCQ_MULTI,
        QuestionType.TRUE_FALSE,
        QuestionType.DROPDOWN,
    }
)


class QuestionSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1)
    question_text: str = Field(..., min_length=3)
    type: QuestionType
    options: list[str] = Field(default_factory=list)
    correct_answer: str | None = None
    explanation: str = Field(..., min_length=3)
    marks: int = Field(default=2, ge=1, le=100)
    difficulty: Difficulty = Difficulty.MEDIUM
    blooms_level: BloomsLevel | None = None
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("question_text")
    @classmethod
    def _question_text_not_blank(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("question_text must contain at least 3 characters")
        return value

    @field_validator("explanation")
    @classmethod
    def _explanation_required(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("explanation is required for every question")
        return value

    @field_validator("options")
    @classmethod
    def _options_valid(cls, options: list[str]) -> list[str]:
        cleaned = [option.strip() for option in options]
        if not cleaned:
            return cleaned
        lowered = [option.lower() for option in cleaned]
        for option, lower in zip(cleaned, lowered):
            if any(pattern in lower for pattern in META_OPTION_PATTERNS):
                raise ValueError(f"meta or absolute option is not allowed: '{option}'")
        if len(set(lowered)) != len(lowered):
            raise ValueError("options for a question must be distinct")
        return cleaned

    @model_validator(mode="after")
    def _validate_answer_for_choice_types(self) -> "QuestionSchema":
        if self.type not in SINGLE_CHOICE_TYPES:
            return self
        if not self.correct_answer or not self.correct_answer.strip():
            raise ValueError("correct_answer is required for choice-based questions")

        if self.type == QuestionType.TRUE_FALSE:
            expected = {"True", "False"}
            if set(self.options) != expected:
                raise ValueError('true_false questions must have exactly the options ["True", "False"]')
            if self.correct_answer not in expected:
                raise ValueError("correct_answer for true_false must be 'True' or 'False'")
            return self

        if not self.options:
            raise ValueError("choice-based questions must have non-empty options")

        if self.type == QuestionType.MCQ_MULTI:
            parts = [part.strip() for part in re.split(r"[;,\n|]", self.correct_answer) if part.strip()]
            if len(parts) < 2:
                raise ValueError("mcq_multi correct_answer must list at least 2 options")
            if not all(part in self.options for part in parts):
                raise ValueError("every mcq_multi correct_answer entry must exactly match an option")
            return self

        if self.correct_answer not in self.options:
            raise ValueError("correct_answer must exactly match one of the options")
        return self


class GenerateExamRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    topic: str = Field(..., min_length=2, max_length=500)
    subtopics: list[str] = Field(default_factory=list, max_length=20)
    questionCount: int = Field(alias="question_count", default=5, ge=1, le=50)
    difficulty: Difficulty = Difficulty.MIXED
    bloomsLevel: BloomsLevel | None = Field(alias="blooms_level", default=None)


class ExamGenerationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(..., min_length=1)
    subtopics: list[str] = Field(default_factory=list)
    difficulty: Difficulty = Difficulty.MIXED
    blooms_level: BloomsLevel | None = None
    questions: list[QuestionSchema] = Field(..., min_length=1)
    generation_metadata: dict[str, Any] = Field(default_factory=dict)
