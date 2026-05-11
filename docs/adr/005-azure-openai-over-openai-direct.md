# ADR-005: Azure OpenAI as Primary AI Provider

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead

---

## Context

The curriculum generation pipeline and assessment features require access to a large language model (LLM). Two providers were evaluated:

1. **OpenAI API (direct)** — `api.openai.com`, billed per token, globally available
2. **Azure OpenAI Service** — OpenAI models hosted on Microsoft Azure infrastructure, billed via Azure subscription

The platform is deployed on Azure (App Service, Azure Postgres, Azure Redis). The product is targeting a Nigerian education market where data residency and enterprise agreements may become relevant.

## Decision

**Azure OpenAI** is used as the primary AI provider.

- **Chat model:** `gpt-4.1-mini` deployed as `AZURE_OPENAI_DEPLOYMENT`
- **Embedding model:** `text-embedding-3-small` deployed on a separate resource (different API key and endpoint)

The `OPENAI_API_KEY` variable exists in the environment but is not actively used in production code.

## Consequences

**Positive:**
- All AI compute stays within the Azure subscription — unified billing with the rest of the infrastructure
- Azure OpenAI provides higher rate limits via Azure deployment quotas (adjustable on request) compared to OpenAI's default tier limits
- Data processed through Azure OpenAI is not used to train OpenAI models (enterprise privacy terms)
- Aligned with Azure DevOps CI/CD pipeline and Azure deployment philosophy
- Consistent with potential future enterprise/government school procurement requirements

**Negative:**
- Azure OpenAI model availability lags behind `api.openai.com` by weeks to months. New models must wait for Azure deployment availability.
- Two separate resources/endpoints are required (chat and embeddings), adding configuration complexity — two sets of API keys, endpoints, and deployment names
- Azure-specific SDK initialization — cannot trivially switch to direct OpenAI without code changes in `AiService`
