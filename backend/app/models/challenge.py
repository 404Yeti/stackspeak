from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, model_validator

Difficulty = Literal["beginner", "intermediate", "advanced"]

# Extensible by design: adding a language is a one-line change here, not a
# change to the `language` field's type (which stays a plain validated str)
# or anywhere it's used.
SUPPORTED_LANGUAGES = {"python"}


def _validate_language(value: str) -> str:
    if value not in SUPPORTED_LANGUAGES:
        supported = sorted(SUPPORTED_LANGUAGES)
        raise ValueError(f"unsupported language {value!r}; supported: {supported}")
    return value


Language = Annotated[str, AfterValidator(_validate_language)]


class TestCase(BaseModel):
    """A single deterministic test case. Not executed by AUD-51 — this is
    data describing expected behavior, for future use by a sandboxed runner
    and for display (e.g. TerminalPanel seed data).
    """

    # Tells pytest this isn't a test class despite the name — "TestCase" is
    # the right domain name here, not a pytest collection target.
    __test__ = False

    description: str
    input: Any
    expected_output: Any | None = None
    expected_exception: str | None = None
    is_edge_case: bool = False
    # Excluded entirely from the public API response, not just redacted —
    # held-out cases a student should never see.
    hidden: bool = False

    @model_validator(mode="after")
    def exactly_one_outcome(self) -> "TestCase":
        has_output = self.expected_output is not None
        has_exception = self.expected_exception is not None
        if has_output == has_exception:
            raise ValueError(
                "exactly one of expected_output or expected_exception must be set"
            )
        return self


class PublicTestCase(BaseModel):
    """Student-facing test case — never carries `hidden` (it's filtered out
    entirely before this model is built) or anything instructor-only."""

    description: str
    input: Any
    expected_output: Any | None = None
    expected_exception: str | None = None
    is_edge_case: bool = False


class EvaluationGuidance(BaseModel):
    """Instructor-only rubric. Technical and communication criteria are kept
    as separate lists — never collapsed into one score — per AGENTS.md's
    technical-vs-spoken-English assessment principle.
    """

    technical_criteria: list[str]
    communication_criteria: list[str]


class ChallengeSummary(BaseModel):
    """Lightweight listing shape — GET /api/challenges returns these, not
    full challenge payloads, since a real catalog will have many entries."""

    id: str
    version: int
    title: str
    language: Language
    difficulty: Difficulty
    topic: str


class ChallengePublic(BaseModel):
    """Everything a student is allowed to see. No `corrected_solution`, no
    `instructor_notes`, no `evaluation_guidance`, no hidden test cases —
    structurally impossible to leak them, since this model has no fields to
    hold them in the first place (see Challenge.to_public)."""

    id: str
    version: int
    title: str
    language: Language
    difficulty: Difficulty
    topic: str
    learning_objectives: list[str]
    starter_code: str
    expected_behavior: str
    bug_description: str
    test_cases: list[PublicTestCase]
    explanation_prompts: list[str]
    defend_prompts: list[str]


class Challenge(BaseModel):
    """Full internal challenge record. Never serialize this directly over
    the public API — use `to_public()` / `to_summary()`, which build the
    response from an explicit allow-list of fields rather than excluding a
    deny-list, so a new private field added here never leaks by accident."""

    id: str
    version: int
    title: str
    language: Language
    difficulty: Difficulty
    topic: str
    learning_objectives: list[str]
    starter_code: str
    expected_behavior: str
    bug_description: str
    corrected_solution: str
    test_cases: list[TestCase]
    explanation_prompts: list[str]
    defend_prompts: list[str]
    instructor_notes: str
    evaluation_guidance: EvaluationGuidance

    def to_summary(self) -> ChallengeSummary:
        return ChallengeSummary(
            id=self.id,
            version=self.version,
            title=self.title,
            language=self.language,
            difficulty=self.difficulty,
            topic=self.topic,
        )

    def to_public(self) -> ChallengePublic:
        return ChallengePublic(
            id=self.id,
            version=self.version,
            title=self.title,
            language=self.language,
            difficulty=self.difficulty,
            topic=self.topic,
            learning_objectives=self.learning_objectives,
            starter_code=self.starter_code,
            expected_behavior=self.expected_behavior,
            bug_description=self.bug_description,
            test_cases=[
                PublicTestCase(
                    description=tc.description,
                    input=tc.input,
                    expected_output=tc.expected_output,
                    expected_exception=tc.expected_exception,
                    is_edge_case=tc.is_edge_case,
                )
                for tc in self.test_cases
                if not tc.hidden
            ],
            explanation_prompts=self.explanation_prompts,
            defend_prompts=self.defend_prompts,
        )
