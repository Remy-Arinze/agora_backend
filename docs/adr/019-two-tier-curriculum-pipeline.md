# ADR-019: Two-Tier Curriculum Pipeline (Super Admin + School Admin)

**Status:** Accepted  
**Date:** 2025-Q3  
**Deciders:** Engineering Lead, Product

---

## Context

Schools need curriculum and scheme of work for their teachers. Two sources of curriculum content exist:
1. **National/standard curriculum** — aligned with NERDC (Nigerian Educational Research and Development Council) standards, curated and validated centrally
2. **School-specific curriculum** — custom syllabi, proprietary teaching materials, or school-specific adaptations

A choice had to be made about whether these should be a single pipeline or two distinct ones.

## Decision

Implement a **two-tier curriculum pipeline**:

### Tier 1: Super Admin (National Standard)
- Super Admin uploads PDFs/DOCX of national curriculum documents for a specific `AgoraSubject` + grade level
- AI parses them into `AgoraCurriculumSource` records
- Super Admin consolidates approved sources into a versioned, published `AgoraCurriculum`
- Published curricula are available to **all schools** on the platform to base their schemes of work on

### Tier 2: School Admin (Custom)
- School Admin uploads their own curriculum documents to `SchoolCurriculumDoc`
- AI parses them (same BullMQ queue, different processor path)
- School Admin generates a `SchemeOfWork` using either only their documents, only the Agora standard, or a weighted merge of both (`SchemeGenerationMode`: `AGORA_ONLY | SCHOOL_ONLY | MERGED`)
- Generated schemes belong exclusively to the school (`schoolId` scoped) — not shared with the platform

## Consequences

**Positive:**
- Schools that follow national standards benefit from centrally curated, validated content without doing their own document work
- Schools with proprietary curricula (e.g. international schools, specialised institutions) are not forced to use national standards
- The `MERGED` mode creates a powerful capability: schools can base their scheme on national content but adjust weighting for their own materials
- Data isolation: school-uploaded documents never become part of the Agora global library without explicit promotion

**Negative:**
- Two parallel but similar pipelines increase code complexity — `AgoraCurriculumSource` and `SchoolCurriculumDoc` are structurally very similar but with different ownership and access rules
- The `SchemeGenerationMode` adds branching in `AiService.generateSchemeOfWork()` — different prompt construction per mode
- School-uploaded documents are private to the school, preventing curriculum sharing between schools even when beneficial (addressed in future by the Peer-to-Peer Curated Library concept in `docs/curriculum-discovery-plan.md`)
