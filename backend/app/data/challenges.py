from app.models.challenge import Challenge, EvaluationGuidance, TestCase

# Contract for this challenge, applied consistently across starter_code,
# expected_behavior, corrected_solution, and test_cases: an empty list
# raises ValueError rather than returning a sentinel like 0.0. See
# instructor_notes for why 0.0 is a defensible alternative a student could
# reasonably choose and defend instead.

_STARTER_CODE = """def get_average(nums):
    total = 0
    for n in nums:
        total += n
    return total / len(nums)

print(get_average([10, 20, 30]))"""

_CORRECTED_SOLUTION = """def get_average(nums):
    if not nums:
        raise ValueError("cannot compute the average of an empty list")
    total = 0
    for n in nums:
        total += n
    return total / len(nums)

print(get_average([10, 20, 30]))"""

AVERAGE_OF_LIST = Challenge(
    id="average-of-list",
    version=1,
    title="Average of a List",
    language="python",
    difficulty="beginner",
    topic="Lists & aggregation",
    learning_objectives=[
        "Trace a loop that accumulates a running total",
        "Identify a missing edge-case check before it causes a runtime error",
        "Distinguish a genuine bug from a legitimate design choice, and defend "
        "a choice with reasoning",
    ],
    starter_code=_STARTER_CODE,
    expected_behavior=(
        "Returns the arithmetic mean of a list of numbers. Raises ValueError for "
        "an empty list, since the average of zero values has no defined numeric "
        "result."
    ),
    bug_description=(
        "get_average divides by len(nums) without checking whether nums is empty "
        "first, so calling it with [] raises an unhandled ZeroDivisionError "
        "instead of a clear, intentional error."
    ),
    corrected_solution=_CORRECTED_SOLUTION,
    test_cases=[
        TestCase(
            description="Calculates the average of a typical list",
            input=[10, 20, 30],
            expected_output=20.0,
        ),
        TestCase(
            description="Handles negative numbers",
            input=[-10, 5, -3],
            expected_output=-8 / 3,
        ),
        TestCase(
            description="Handles decimal values",
            input=[1.5, 2.5, 3.0],
            expected_output=7.0 / 3,
        ),
        TestCase(
            description="Raises ValueError for an empty list rather than dividing by zero",
            input=[],
            expected_exception="ValueError",
            is_edge_case=True,
        ),
        TestCase(
            description="Handles a single-element list",
            input=[42],
            expected_output=42.0,
            is_edge_case=True,
            hidden=True,
        ),
    ],
    explanation_prompts=[
        "In your own words, what does get_average do?",
        "Walk through what happens, line by line, when nums is an empty list.",
        "Why does total / len(nums) raise a ZeroDivisionError here, and why isn't "
        "that a clear, informative error for the caller?",
    ],
    defend_prompts=[
        "Why did you choose to raise a ValueError for an empty list instead of "
        "returning 0?",
        "What would break if get_average silently returned 0.0 for empty input "
        "instead?",
        "How would you decide between raising an exception and returning a "
        "sentinel value in a real codebase?",
    ],
    instructor_notes=(
        "Canonical fix here raises ValueError on empty input. Returning 0.0 is a "
        "defensible alternative under some specs (treating 'no data' as a "
        "baseline of zero, common in some reporting/aggregation contexts) — a "
        "student who argues for it with clear reasoning about their system's "
        "requirements should score well on engineering judgment, even though it "
        "diverges from this challenge's reference solution. The concern worth "
        "raising if a student picks 0.0 without discussion: it can silently mask "
        "an upstream bug (e.g. a caller that expected a non-empty list due to a "
        "filtering bug elsewhere) by returning a plausible-looking number instead "
        "of surfacing the problem. Evaluate whether they recognize this tradeoff "
        "and defend their choice coherently — not whether they matched the exact "
        "reference contract."
    ),
    evaluation_guidance=EvaluationGuidance(
        technical_criteria=[
            "Correctly identifies that the bug is division by zero when nums is empty",
            "Proposes a fix that checks for the empty-list case before dividing",
            "Chosen behavior (exception vs. sentinel) is handled consistently, "
            "not left half-implemented",
            "Does not introduce a regression in the non-empty-list behavior",
        ],
        communication_criteria=[
            "Explains what the function does before describing what's wrong with it",
            "States the root cause (division by zero) rather than only "
            "describing the symptom (the program crashes)",
            "Articulates a clear rationale for the chosen fix when defending "
            "it, even if it differs from the reference solution",
        ],
    ),
)

CHALLENGES: dict[str, Challenge] = {AVERAGE_OF_LIST.id: AVERAGE_OF_LIST}
