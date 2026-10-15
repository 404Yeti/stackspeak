from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "stackspeak-api"
    # commit is None locally (no RENDER_GIT_COMMIT env var); Render sets it in production.
    assert body["commit"] is None
