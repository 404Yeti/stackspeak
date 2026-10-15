from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PRIVATE_KEYS = {"corrected_solution", "instructor_notes", "evaluation_guidance", "hidden"}


def test_list_challenges_returns_summary() -> None:
    response = client.get("/api/challenges")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1

    summary = body[0]
    assert summary["id"] == "average-of-list"
    assert set(summary.keys()) == {"id", "version", "title", "language", "difficulty", "topic"}


def test_get_challenge_returns_public_shape() -> None:
    response = client.get("/api/challenges/average-of-list")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "average-of-list"
    assert body["language"] == "python"
    assert "starter_code" in body
    assert "test_cases" in body


def test_get_challenge_unknown_id_returns_404() -> None:
    response = client.get("/api/challenges/does-not-exist")

    assert response.status_code == 404


def test_get_challenge_never_leaks_private_fields() -> None:
    response = client.get("/api/challenges/average-of-list")
    body = response.json()

    leaked_top_level = PRIVATE_KEYS & set(body.keys())
    assert not leaked_top_level, f"private fields leaked at top level: {leaked_top_level}"

    for test_case in body["test_cases"]:
        leaked_in_test_case = PRIVATE_KEYS & set(test_case.keys())
        assert not leaked_in_test_case, (
            f"private fields leaked in a test case: {leaked_in_test_case}"
        )


def test_get_challenge_omits_hidden_test_cases() -> None:
    response = client.get("/api/challenges/average-of-list")
    body = response.json()

    # The seed has one hidden single-element-list case ([42]) not meant for students.
    inputs = [tc["input"] for tc in body["test_cases"]]
    assert [42] not in inputs


def test_list_challenges_never_leaks_private_fields() -> None:
    response = client.get("/api/challenges")
    body = response.json()

    for summary in body:
        leaked = PRIVATE_KEYS & set(summary.keys())
        assert not leaked, f"private fields leaked in challenge summary: {leaked}"
