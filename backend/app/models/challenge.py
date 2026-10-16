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
    """What the initial load (Read / Explain / Fix) may show. Deliberately
    spoiler-free: no `bug_description`, `expected_behavior`, test cases, or
    prompts that name the bug, and structurally no private fields either.
    Later-stage content lives in the ChallengeTrace / ChallengeDefend /
    ChallengeReview models below — see docs/challenge-schema.md.

    Stage separation is a UX choice, not a security or anti-cheating
    boundary: with no auth and no server-side state, every stage endpoint
    can be called directly."""

    id: str
    version: int
    title: str
    language: Language
    difficulty: Difficulty
    topic: str
    learning_objectives: list[str]
    starter_code: str
    explain_prompts: list[str]
    fix_prompts: list[str]


class ChallengeTrace(BaseModel):
    """Trace-stage content: the contract and the public test cases the
    student reasons about by hand. Hidden cases are filtered out entirely."""

    id: str
    version: int
    expected_behavior: str
    test_cases: list[PublicTestCase]
    trace_prompts: list[str]


class ChallengeDefend(BaseModel):
    """Defend-stage content."""

    id: str
    version: int
    defend_prompts: list[str]


class ChallengeReview(BaseModel):
    """Feedback-stage content, including the reference implementation. Still
    an explicit allow-list: `instructor_notes` and `evaluation_guidance`
    stay instructor-only, and the checklists here are separate,
    student-facing fields rather than the instructor rubric."""

    id: str
    version: int
    bug_description: str
    corrected_solution: str
    technical_checklist: list[str]
    communication_checklist: list[str]
    alternatives_note: str


class Challenge(BaseModel):
    """Full internal challenge record. Never serialize this directly over
    the public API — use the `to_*()` methods, which build each response from
    an explicit allow-list of fields rather than excluding a deny-list, so a
    new private field added here never leaks by accident."""

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
    explain_prompts: list[str]
    fix_prompts: list[str]
    trace_prompts: list[str]
    defend_prompts: list[str]
    technical_checklist: list[str]
    communication_checklist: list[str]
    alternatives_note: str
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
            explain_prompts=self.explain_prompts,
            fix_prompts=self.fix_prompts,
        )

    def to_trace(self) -> ChallengeTrace:
        return ChallengeTrace(
            id=self.id,
            version=self.version,
            expected_behavior=self.expected_behavior,
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
            trace_prompts=self.trace_prompts,
        )

    def to_defend(self) -> ChallengeDefend:
        return ChallengeDefend(
            id=self.id,
            version=self.version,
            defend_prompts=self.defend_prompts,
        )

    def to_review(self) -> ChallengeReview:
        return ChallengeReview(
            id=self.id,
            version=self.version,
            bug_description=self.bug_description,
            corrected_solution=self.corrected_solution,
            technical_checklist=self.technical_checklist,
            communication_checklist=self.communication_checklist,
            alternatives_note=self.alternatives_note,
        )
