# ADR 022: Modular Prisma Schema Architecture

**Date:** April 28, 2026  
**Status:** Accepted  
**Context:**  
As Agora has grown, the core `schema.prisma` file ballooned to nearly 2,000 lines containing 80+ models and enums. This monolithic file became difficult to navigate, increased the likelihood of merge conflicts, and obscured the domain boundaries within the application. We needed a way to organize our database models to align with our NestJS Domain-Driven Design (DDD) modules.

**Decision:**  
We transitioned from a single monolithic `schema.prisma` to a modular, multi-file schema architecture.

1. **Prisma Version:** We standardized on Prisma `v5.22.0` (rather than migrating to v7 which introduces a breaking change by removing the database URL from the schema file). This specific version allows us to safely use the `prismaSchemaFolder` preview feature while maintaining 100% backward compatibility with our environment configurations.
2. **Directory Structure:** The `prisma/schema.prisma` file was deleted and replaced with a `prisma/schema/` directory.
3. **Domain Grouping:** We extracted the 81 models and enums into 8 domain-specific `.prisma` files corresponding to our backend modules:
   - `config.prisma` (Database connection and Generator setup)
   - `users.prisma` (User, Roles, Auth, Sessions)
   - `schools.prisma` (School, Subs, ApplicationErrors, ToolAccess, Campaigns)
   - `staff.prisma` (Teachers, Admins, Permissions)
   - `students.prisma` (Students, Parents, Enrollments, Transfers)
   - `academics.prisma` (Classes, Sessions, Faculties, Terms)
   - `curriculum.prisma` (Subjects, Timetables, Schemes of Work)
   - `assessments.prisma` (Grades, Exams, Assessment Templates)
   - `resources.prisma` (Files, Chat Logs, AI Usage)

**Consequences:**  
- **Pros:** 
  - Massive improvement in developer experience (DX) and readability.
  - Fewer merge conflicts since teams working on `curriculum` rarely touch `users` models.
  - Better alignment with the NestJS modular architecture.
- **Cons:** 
  - Requires the `prismaSchemaFolder` preview feature flag in the `config.prisma`.
  - Commands like `npx prisma format` now iterate over a folder instead of a single file, though the performance difference is negligible.
