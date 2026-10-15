// Shared static sample — used by both the Daily Challenge workspace preview
// and the homepage hero's IDE+voice preview, so they show the same code
// instead of two independently-maintained copies. Matches the real
// average-of-list seed challenge's starter_code (see
// backend/app/data/challenges.py) for continuity, though this constant
// exists purely for frontend display and isn't read from the API.
export const SAMPLE_CHALLENGE_CODE = `def get_average(nums):
    total = 0
    for n in nums:
        total += n
    return total / len(nums)

print(get_average([10, 20, 30]))`;
