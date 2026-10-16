import json

from fastapi.testclient import TestClient

from app.data.challenges import AVERAGE_OF_LIST
from app.main import app

client = TestClient(app)

CHALLENGE_URL = "/api/challenges/average-of-list"

# Exact key sets are asserted (not "no forbidden keys") so any new field on a
# response is a deliberate, reviewed change.
LOAD_KEYS = {
    "id",
    "version",
    "title",
    "language",
    "difficulty",
    "topic",
    "learning_objectives",
    "starter_code",
    "explain_prompts",
    "fix_prompts",
}
TRACE_KEYS = {"id", "version", "expected_behavior", "test_cases", "trace_prompts"}
DEFEND_KEYS = {"id", "version", "defend_prompts"}
REVIEW_KEYS = {
    "id",
    "version",
    "bug_description",
    "corrected_solution",
    "technical_checklist",
    "communication_checklist",
    "alternatives_note",
}
PRIVATE_KEYS = {"instructor_notes", "evaluation_guidance", "hidden"}
STAGE_PATHS = ["", "/trace", "/defend", "/review"]


def _all_keys(value: object) -> set[str]:
    """Every dict key anywhere in a JSON value."""
    if isinstance(value, dict):
        keys = set(value.keys())
        for child in value.values():
            keys |= _all_keys(child)
        return keys
    if isinstance(value, list):
        keys: set[str] = set()
        for child in value:
            keys |= _all_keys(child)
        return keys
    return set()


def test_list_challenges_returns_summary() -> None:
    response = client.get("/api/challenges")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1

    summary = body[0]
    assert summary["id"] == "average-of-list"
    assert set(summary.keys()) == {"id", "version", "title", "language", "difficulty", "topic"}


def test_list_challenges_never_leaks_private_fields() -> None:
    for summary in client.get("/api/challenges").json():
        assert not (PRIVATE_KEYS | {"corrected_solution"}) & set(summary.keys())


def test_get_challenge_returns_load_shape() -> None:
    response = client.get(CHALLENGE_URL)

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == LOAD_KEYS
    assert body["id"] == "average-of-list"
    assert body["language"] == "python"
    assert body["version"] == 2


def test_load_response_contains_no_spoilers() -> None:
    """The initial load must not reveal the bug, the contract, the tests, or the
    solution — checked on the raw serialized text, not just key names."""
    raw = client.get(CHALLENGE_URL).text.lower()

    for removed_key in (
        "bug_description",
        "expected_behavior",
        "test_cases",
        "explanation_prompts",
        "defend_prompts",
        "trace_prompts",
        "corrected_solution",
        "alternatives_note",
        "technical_checklist",
        "communication_checklist",
    ):
        assert removed_key not in raw, removed_key

    # Content strings that give the answer away (all appear in later stages).
    for spoiler in (
        "zerodivisionerror",
        "valueerror",
        "empty",
        "cannot compute the average",
        "raise ",
        "if not nums",
    ):
        assert spoiler not in raw, spoiler


def test_stage_endpoints_return_exact_shapes() -> None:
    assert set(client.get(f"{CHALLENGE_URL}/trace").json().keys()) == TRACE_KEYS
    assert set(client.get(f"{CHALLENGE_URL}/defend").json().keys()) == DEFEND_KEYS
    assert set(client.get(f"{CHALLENGE_URL}/review").json().keys()) == REVIEW_KEYS


def test_unknown_id_returns_404_on_every_endpoint() -> None:
    for suffix in STAGE_PATHS:
        response = client.get(f"/api/challenges/does-not-exist{suffix}")
        assert response.status_code == 404, suffix


def test_no_endpoint_leaks_private_fields() -> None:
    for suffix in STAGE_PATHS:
        body = client.get(f"{CHALLENGE_URL}{suffix}").json()
        leaked = PRIVATE_KEYS & _all_keys(body)
        assert not leaked, f"{suffix or '/'} leaked {leaked}"


def test_instructor_only_text_never_appears_in_any_response() -> None:
    private_text = [
        AVERAGE_OF_LIST.instructor_notes,
        *AVERAGE_OF_LIST.evaluation_guidance.technical_criteria,
        *AVERAGE_OF_LIST.evaluation_guidance.communication_criteria,
    ]
    for suffix in STAGE_PATHS:
        payload = json.dumps(client.get(f"{CHALLENGE_URL}{suffix}").json())
        for text in private_text:
            assert text not in payload, f"{suffix or '/'} leaked instructor text"


def test_corrected_solution_only_in_review() -> None:
    solution = AVERAGE_OF_LIST.corrected_solution
    for suffix in ["", "/trace", "/defend"]:
        payload = json.dumps(client.get(f"{CHALLENGE_URL}{suffix}").json())
        assert "corrected_solution" not in payload
        assert solution not in payload

    review = client.get(f"{CHALLENGE_URL}/review").json()
    assert review["corrected_solution"] == solution


def test_trace_omits_hidden_test_cases() -> None:
    body = client.get(f"{CHALLENGE_URL}/trace").json()

    # The seed has one hidden single-element-list case ([42]) not meant for students.
    inputs = [tc["input"] for tc in body["test_cases"]]
    assert [42] not in inputs
    assert len(body["test_cases"]) == 4
    for test_case in body["test_cases"]:
        assert "hidden" not in test_case


def test_checklists_are_separate_and_non_empty() -> None:
    review = client.get(f"{CHALLENGE_URL}/review").json()

    assert review["technical_checklist"]
    assert review["communication_checklist"]
    assert set(review["technical_checklist"]).isdisjoint(review["communication_checklist"])


def test_stage_endpoints_are_not_cacheable() -> None:
    for suffix in ["/trace", "/defend", "/review"]:
        response = client.get(f"{CHALLENGE_URL}{suffix}")
        assert response.headers["cache-control"] == "no-store", suffix
