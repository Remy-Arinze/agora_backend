# ADR-011: Cloudinary for File Storage

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

The platform needs file storage for: school logos, staff profile photos, student profile photos, curriculum source documents (PDFs, DOCX), and school curriculum uploads. Cloud storage options considered:

1. **Azure Blob Storage** — native to the Azure deployment environment
2. **AWS S3** — industry standard, well-supported
3. **Cloudinary** — media-focused cloud storage with built-in image transformation

## Decision

**Cloudinary** is used for all file storage.

All file operations are routed through `CloudinaryService` (`src/storage/cloudinary/cloudinary.service.ts`). Stored file URLs are persisted in the database (e.g. `SchoolAdmin.profileImage`, `AgoraCurriculumSource.fileUrl`).

## Consequences

**Positive:**
- Built-in image transformations (resize, crop, quality) for profile photos — no separate image processing library needed
- Automatic CDN delivery — uploaded files are served globally with low latency without extra configuration
- Generous free tier sufficient for early-stage product; paid tiers scale unit-economics-friendly
- Simple SDK (`cloudinary` npm package) with multipart upload support built in

**Negative:**
- Adds a third-party dependency outside the Azure ecosystem — a separate account and credential set to manage
- Cloudinary is not free at scale — large schools uploading many curriculum PDFs will increase storage costs
- If Cloudinary is down, file uploads fail. Not mitigated yet — no fallback storage provider configured.
- Files stored in Cloudinary are accessible via public URL (security is by obscurity for the URL). For sensitive curriculum documents, signed URLs would be more appropriate. This is a known gap.
