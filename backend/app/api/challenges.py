from fastapi import APIRouter, HTTPException

from app.data.challenges import CHALLENGES
from app.models.challenge import ChallengePublic, ChallengeSummary

router = APIRouter(tags=["challenges"])


@router.get("/challenges", response_model=list[ChallengeSummary])
def list_challenges() -> list[ChallengeSummary]:
    return [challenge.to_summary() for challenge in CHALLENGES.values()]


@router.get("/challenges/{challenge_id}", response_model=ChallengePublic)
def get_challenge(challenge_id: str) -> ChallengePublic:
    challenge = CHALLENGES.get(challenge_id)
    if challenge is None:
        raise HTTPException(status_code=404, detail=f"Challenge '{challenge_id}' not found")
    return challenge.to_public()
