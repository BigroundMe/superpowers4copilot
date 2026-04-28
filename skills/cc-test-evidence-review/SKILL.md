---
name: cc-test-evidence-review
description: "Quality review of test files and manual evidence documents. Goes beyond existence checks — evaluates assertion coverage, edge case handling, naming conventions, and evidence completeness. Produces ADEQUATE/INCOMPLETE/MISSING verdict per story. Run before QA sign-off or on demand."
---

# Test Evidence Review

`/cc-smoke-check` verifies that test files **exist** and **pass**. This skill
goes further — it reviews the **quality** of those tests and evidence documents.
A test file that exists and passes may still leave critical behaviour uncovered.
A manual evidence doc that exists may lack the sign-offs required for closure.

**Output:** Summary report (in conversation) + optional `production/qa/evidence-review-[date].md`

**When to run:**
- Before QA hand-off sign-off (`/cc-team-qa` Phase 5)
- On any story where test quality is in question
- As part of milestone review for Logic and Integration story quality audit

---

## 1. Parse Arguments

**Modes:**
- `/cc-test-evidence-review [story-path]` — review a single story's evidence
- `/cc-test-evidence-review sprint` — review all stories in the current sprint
- `/cc-test-evidence-review [system-name]` — review all stories in an epic/system
- No argument — ask which scope: "Single story", "Current sprint", "A system"

---

## 2. Load Stories in Scope

Based on the argument:

**Single story**: Use `read_file` on the story file directly. Extract: Story Type, Test
Evidence section, story slug, system name.

**Sprint**: Read the most recently modified file in `production/sprints/`.
Extract the list of story file paths from the sprint plan. Read each story file.

**System**: Use `file_search` with pattern `production/epics/[system-name]/story-*.md`. Read each.

For each story, collect:
- `Type:` field (Logic / Integration / Visual/Feel / UI / Config/Data)
- `## Test Evidence` section — the stated expected test file path or evidence doc
- Story slug (from file name)
- System name (from directory path)
- Acceptance Criteria list (all checkbox items)

---

## 3. Locate Evidence Files

For each story, find the evidence:

**Logic stories**: Use `file_search` with pattern `tests/unit/[system]/[story-slug]_test.*`
  - If not found, also try: use `grep_search` in `tests/unit/[system]/` for files
    containing the story slug

**Integration stories**: Use `file_search` with pattern `tests/integration/[system]/[story-slug]_test.*`
  - Also check `production/session-logs/` for playtest records mentioning the story

**Visual/Feel and UI stories**: Use `file_search` with pattern `production/qa/evidence/[story-slug]-evidence.*`

**Config/Data stories**: Use `file_search` with pattern `production/qa/smoke-*.md` (any smoke check report)

Note what was found (path) or not found (gap) for each story.

---

## 4. Review Automated Test Quality (Logic / Integration)

For each test file found, use `read_file` to read it and evaluate:

### Assertion coverage

Count the number of distinct assertions (lines containing assert, expect,
check, verify, or engine-specific assertion patterns). Low assertion count is
a quality signal — a test that makes only 1 assertion per test function may
not cover the range of expected behaviour.

Thresholds:
- **3+ assertions per test function** → normal
- **1-2 assertions per test function** → note as potentially thin
- **0 assertions** (test exists but no asserts) → flag as BLOCKING — the
  test passes vacuously and proves nothing

### Edge case coverage

For each acceptance criterion in the story that contains a number, threshold,
or "when X happens" conditional: check whether a test function name or
test body references that specific case.

Heuristics:
- Use `grep_search` on the test file for "zero", "max", "null", "empty", "min", "invalid",
  "boundary", "edge" — presence of any is a positive signal
- If the story has a Formulas section with specific bounds: check whether
  tests exercise at minimum/maximum values

### Naming quality

Test function names should describe: the scenario + the expected result.
Pattern: `test_[scenario]_[expected_outcome]`

Flag functions named generically (`test_1`, `test_run`, `testBasic`) as
**naming issues** — they make failures harder to diagnose.

### Formula traceability

For Logic stories where the GDD has a Formulas section: check that the test
file contains at least one test whose name or comment references the formula
name or a formula value. A test that exercises a formula without mentioning
it by name is harder to maintain when the formula changes.

---

## 5. Review Manual Evidence Quality (Visual/Feel / UI)

For each evidence document found, use `read_file` to read it and evaluate:

### Criterion linkage

The evidence doc should reference each acceptance criterion from the story.
Check: does the evidence doc contain each criterion (or a clear rephrasing)?
Missing criteria mean a criterion was never verified.

### Sign-off completeness

Check for three sign-off lines (or equivalent fields):
- Developer sign-off
- Designer / art-lead sign-off (for Visual/Feel)
- QA lead sign-off

If any are missing or blank: flag as INCOMPLETE — the story cannot be fully
closed without all required sign-offs.

### Screenshot / artefact completeness

For Visual/Feel stories: check whether screenshot file paths are referenced
in the evidence doc. If referenced, use `file_search` for them to confirm they exist.

For UI stories: check whether a walkthrough sequence (step-by-step interaction
log) is present.

### Date coverage

Evidence doc should have a date. If the date is earlier than the story's
last major change (heuristic: compare against sprint start date from the sprint
plan), flag as POTENTIALLY STALE — the evidence may not cover the final
implementation.

---

## 6. Build the Review Report

For each story, assign a verdict:

| Verdict | Meaning |
|---------|---------|
| **ADEQUATE** | Test/evidence exists, passes quality checks, all criteria covered |
| **INCOMPLETE** | Test/evidence exists but has quality gaps (thin assertions, missing sign-offs) |
| **MISSING** | No test or evidence found for a story type that requires it |

The overall sprint/system verdict is the worst story verdict present.

```markdown
## Test Evidence Review

> **Date**: [date]
> **Scope**: [single story path | Sprint [N] | [system name]]
> **Stories reviewed**: [N]
> **Overall verdict**: ADEQUATE / INCOMPLETE / MISSING

---

### Story-by-Story Results

#### [Story Title] — [Type] — [ADEQUATE/INCOMPLETE/MISSING]

**Test/evidence path**: `[path]` (found) / (not found)

**Automated test quality** *(Logic/Integration only)*:
- Assertion coverage: [N per function on average] — [adequate / thin / none]
- Edge cases: [covered / partial / not found]
- Naming: [consistent / [N] generic names flagged]
- Formula traceability: [yes / no — formula names not referenced in tests]

**Manual evidence quality** *(Visual/Feel/UI only)*:
- Criterion linkage: [N/M criteria referenced]
- Sign-offs: [Developer ✓ | Designer ✗ | QA Lead ✗]
- Artefacts: [screenshots present / missing / N/A]
- Freshness: [dated [date] — current / potentially stale]

**Issues**:
- BLOCKING: [description] *(prevents story-done)*
- ADVISORY: [description] *(should fix before release)*
```

---

## 7. Write Report (Optional)

Ask: "May I write this review to `production/qa/evidence-review-[date].md`?"

Write only after approval using `create_file`.

---

## Next Steps

- **MISSING** stories: write the test or evidence before running `/cc-story-done`.
- **INCOMPLETE** stories: fix the specific gaps noted (add assertions, complete sign-offs).
- Run `/cc-regression-suite audit` to check broader coverage across all GDD critical paths.
- Run `/cc-test-flakiness scan` if any tests showed intermittent failures.
