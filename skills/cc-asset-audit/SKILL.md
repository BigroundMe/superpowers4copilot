---
name: cc-asset-audit
description: "Audits game assets for compliance with naming conventions, file size budgets, format standards, and pipeline requirements. Identifies orphaned assets, missing references, and standard violations."
---

# Asset Audit

This skill is read-only — it produces a report but does not write files.

## Phase 1: Read Standards

Use `read_file` on the art bible or asset standards from the relevant design docs and the
CLAUDE.md naming conventions.

---

## Phase 2: Scan Asset Directories

Scan the target asset directory using `file_search`:

- `assets/art/**/*` for art assets
- `assets/audio/**/*` for audio assets
- `assets/vfx/**/*` for VFX assets
- `assets/shaders/**/*` for shaders
- `assets/data/**/*` for data files

---

## Phase 3: Run Compliance Checks

**Naming conventions:**
- Art: `[category]_[name]_[variant]_[size].[ext]`
- Audio: `[category]_[context]_[name]_[variant].[ext]`
- All files must be lowercase with underscores

**File standards:**
- Textures: Power-of-two dimensions, correct format (PNG for UI, compressed for 3D), within size budget
- Audio: Correct sample rate, format (OGG for SFX, OGG/MP3 for music), within duration limits
- Data: Valid JSON/YAML, schema-compliant

**Orphaned assets:** Use `grep_search` across code for references to each asset file. Flag any with no references.

**Missing assets:** Use `grep_search` across code for asset references and use `file_search` to verify the files exist.

---

## Phase 4: Output Audit Report

```markdown
# Asset Audit Report -- [Category] -- [Date]

## Summary
- **Total assets scanned**: [N]
- **Naming violations**: [N]
- **Size violations**: [N]
- **Format violations**: [N]
- **Orphaned assets**: [N]
- **Missing assets**: [N]
- **Overall health**: [CLEAN / MINOR ISSUES / NEEDS ATTENTION]

## Naming Violations
| File | Expected Pattern | Issue |
|------|-----------------|-------|

## Size Violations
| File | Budget | Actual | Overage |
|------|--------|--------|---------|

## Format Violations
| File | Expected Format | Actual Format |
|------|----------------|---------------|

## Orphaned Assets (no code references found)
| File | Last Modified | Size | Recommendation |
|------|-------------|------|---------------|

## Missing Assets (referenced but not found)
| Reference Location | Expected Path |
|-------------------|---------------|

## Recommendations
[Prioritized list of fixes]

## Verdict: [COMPLIANT / WARNINGS / NON-COMPLIANT]
```

---

## Phase 5: Next Steps

- Fix naming violations using the patterns defined in CLAUDE.md.
- Delete confirmed orphaned assets after manual review.
- Run `/cc-content-audit` to cross-check asset counts against GDD-specified requirements.
