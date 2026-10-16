from fastapi import APIRouter, HTTPException, Response

from app.data.challenges import CHALLENGES
from app.models.challenge import (
    Challenge,
    ChallengeDefend,
    ChallengePublic,
    ChallengeReview,
    ChallengeSummary,
    ChallengeTrace,
)

router = APIRouter(tags=["challenges"])

# Stage endpoints return content that is meant to appear later in the flow.
# That ordering is a UX choice, not an access-control boundary (no auth, no
# server-side state) — `no-store` just keeps intermediaries from caching it.
_NO_STORE = "no-store"


def _get_or_404(challenge_id: str) -> Challenge:
    challenge = CHALLENGES.get(challenge_id)
    if challenge is None:
        raise HTTPException(status_code=404, detail=f"Challenge '{challenge_id}' not found")
    return challenge


@router.get("/challenges", response_model=list[ChallengeSummary])
def list_challenges() -> list[ChallengeSummary]:
    return [challenge.to_summary() for challenge in CHALLENGES.values()]


@router.get("/challenges/{challenge_id}", response_model=ChallengePublic)
def get_challenge(challenge_id: str) -> ChallengePublic:
    return _get_or_404(challenge_id).to_public()


@router.get("/challenges/{challenge_id}/trace", response_model=ChallengeTrace)
def get_challenge_trace(challenge_id: str, response: Response) -> ChallengeTrace:
    challenge = _get_or_404(challenge_id)
    response.headers["Cache-Control"] = _NO_STORE
    return challenge.to_trace()


@router.get("/challenges/{challenge_id}/defend", response_model=ChallengeDefend)
def get_challenge_defend(challenge_id: str, response: Response) -> ChallengeDefend:
    challenge = _get_or_404(challenge_id)
    response.headers["Cache-Control"] = _NO_STORE
    return challenge.to_defend()


@router.get("/challenges/{challenge_id}/review", response_model=ChallengeReview)
def get_challenge_review(challenge_id: str, response: Response) -> ChallengeReview:
    challenge = _get_or_404(challenge_id)
    response.headers["Cache-Control"] = _NO_STORE
    return challenge.to_review()
