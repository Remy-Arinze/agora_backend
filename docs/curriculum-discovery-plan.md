# Curriculum Discovery Enhancement Plan (V2 Backlog)

## Overview
This document outlines the proposed enhancements to the curriculum discovery and matching system in Agora. The goal is to move from a rigid ID-based matching to a semantic, conceptual system that handles custom school subjects and heterogeneous grade levels across different school types.

## Current State
- **Discovery:** Based on exact School Subject ID and exact Grade Level Code (e.g., `JSS_1`).
- **Limitation:** Schools with custom subject names (e.g., "Numeracy" instead of "Mathematics") or non-standard grade levels may not see relevant Agora master curricula.
- **Scope:** Primarily focused on a 1-to-1 mapping between a school class and a single NERDC curriculum segment.

## Core Enhancements

### 1. Semantic Subject Mapping (AI-Powered)
- **Problem:** "Maths" vs "Mathematics" vs "Numeracy".
- **Solution:** Use Vector Embeddings (already supported in the schema) to perform semantic searches. 
- **Implementation:** When a school searches for curricula for a subject like "Logic & Reasoning," the AI can identify that "Critical Thinking" (a master subject) has a high conceptual overlap and suggest it.

### 2. Global "Master Subject" Reference
- **Problem:** Many school subjects are local versions of the same thing.
- **Solution:** Introduce an optional `masterSubjectId` on the `Subject` model in the school's context.
- **Implementation:** Allow School Admins to "Link to Standard" during subject setup. Linking local "ICT 101" to Global "Computer Science" ensures 100% accurate curriculum matching.

### 3. Subject-Alias System
- **Problem:** Rigid codes (e.g., `MTH`) fail if a school uses `MATH`.
- **Solution:** Maintain a global synonym/alias table that learns from school mappings.
- **Benefit:** Reduces manual intervention as the system "learns" that different codes/names refer to the same conceptual subject.

### 4. Curriculum Grade Bands (Bridges)
- **Problem:** Some content is applicable to multiple grades (e.g., "Beginner Coding").
- **Solution:** Move from specific grade codes (`PRIMARY_1`) to Grade Bands (e.g., `LOWER_PRIMARY`, `UPPER_PRIMARY`, `JUNIOR_SEC`).
- **Benefit:** Allows a JSS 1 teacher to discover "Bridge" curricula or introductory content that might have been originally tagged for Primary 6.

### 5. Peer-to-Peer Curated Library
- **Problem:** Super Admin cannot keep up with every niche subject (e.g., "Robotics").
- **Solution:** Allow schools to "Publicize" their custom curricula (with admin approval) to a community-shared library.
- **Benefit:** A school with a unique "Agro-Business" program can help other schools get started by sharing their parsed and validated content.

## Technical Considerations
- **Database Schema:** Minor additions to the `Subject` model and `AgoraCurriculum` model to support `masterSubjectId` and `gradeBands` (array).
- **AI Task:** Create a background job to generate embeddings for all published curricula.
- **Validation:** Add a "Similarity Confidence" score in the UI when recommending non-exact matches.

## Roadmap Status
**Priority:** Medium/High (post-launch iteration)  
**Stakeholders:** School Administrators, Super Admins  
**Dependencies:** Finalization of existing AI Parser and Generation pipeline.
