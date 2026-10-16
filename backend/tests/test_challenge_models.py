import pytest
from pydantic import ValidationError

from app.data.challenges import AVERAGE_OF_LIST
from app.models.challenge import Challenge, EvaluationGuidance, TestCase


def _minimal_challenge(**overrides: object) -> Challenge:
    defaults: dict[str, object] = dict(
        id="sample",
        version=1,
        title="Sample",
        language="python",
        difficulty="beginner",
        topic="Sample topic",
        learning_objectives=["Learn a thing"],
        starter_code="pass",
        expected_behavior="Does a thing.",
        bug_description="Doesn't do the thing.",
        corrected_solution="pass",
        test_cases=[TestCase(description="case", input=1, expected_output=1)],
        explain_prompts=["What does this do?"],
        fix_prompts=["What is wrong?"],
        trace_prompts=["What does it return?"],
        defend_prompts=["Why this fix?"],
        technical_checklist=["Found the bug"],
        communication_checklist=["Explained clearly"],
        alternatives_note="One reference implementation.",
        instructor_notes="Notes for instructors only.",
        evaluation_guidance=EvaluationGuidance(
            technical_criteria=["Correctness"],
            communication_criteria=["Clarity"],
        ),
    )
    defaults.update(overrides)
    return Challenge(**defaults)  # type: ignore[arg-type]


def test_seed_challenge_is_valid() -> None:
    assert AVERAGE_OF_LIST.id == "average-of-list"
    assert AVERAGE_OF_LIST.language == "python"


def test_unsupported_language_rejected() -> None:
    with pytest.raises(ValidationError):
        _minimal_challenge(language="javascript")


def test_test_case_requires_exactly_one_outcome() -> None:
    with pytest.raises(ValidationError):
        TestCase(description="neither set", input=1)

    with pytest.raises(ValidationError):
        TestCase(
            description="both set",
            input=1,
            expected_output=1,
            expected_exception="ValueError",
        )


def test_test_case_accepts_expected_output_only() -> None:
    tc = TestCase(description="ok", input=1, expected_output=2)
    assert tc.expected_output == 2
    assert tc.expected_exception is None


def test_test_case_accepts_expected_exception_only() -> None:
    tc = TestCase(description="ok", input=[], expected_exception="ValueError")
    assert tc.expected_exception == "ValueError"
    assert tc.expected_output is None


def test_to_public_excludes_private_fields() -> None:
    private = {"instructor_notes", "evaluation_guidance", "hidden"}
    for model in (
        AVERAGE_OF_LIST.to_public(),
        AVERAGE_OF_LIST.to_trace(),
        AVERAGE_OF_LIST.to_defend(),
        AVERAGE_OF_LIST.to_review(),
    ):
        assert not private & set(type(model).model_fields), type(model).__name__

    # corrected_solution is allowed only in the review (Feedback) model.
    assert "corrected_solution" not in type(AVERAGE_OF_LIST.to_public()).model_fields
    assert "corrected_solution" not in type(AVERAGE_OF_LIST.to_trace()).model_fields
    assert "corrected_solution" not in type(AVERAGE_OF_LIST.to_defend()).model_fields
    assert "corrected_solution" in type(AVERAGE_OF_LIST.to_review()).model_fields


def test_to_trace_excludes_hidden_test_cases() -> None:
    hidden_count = sum(1 for tc in AVERAGE_OF_LIST.test_cases if tc.hidden)
    assert hidden_count > 0, (
        "seed should include at least one hidden test case to make this test meaningful"
    )

    trace = AVERAGE_OF_LIST.to_trace()
    assert len(trace.test_cases) == len(AVERAGE_OF_LIST.test_cases) - hidden_count


def test_to_summary_shape() -> None:
    summary = AVERAGE_OF_LIST.to_summary()
    assert summary.id == AVERAGE_OF_LIST.id
    assert summary.title == AVERAGE_OF_LIST.title
    assert summary.difficulty == AVERAGE_OF_LIST.difficulty
