# DPSIA Lambda

<p align="center">
  <img src="docs/dpsia-header.png" alt="DPSIA Lambda — Multi-provider AI security assessment" width="800">
</p>

Standalone AWS Lambda service for Data Protection & Security Impact Assessments (DPSIA). Performs automated vendor security assessments using multi-provider parallel research and Claude AI synthesis.

## Architecture

```
Any Caller (Jira Automation, curl, Claude Code, etc.)
  -> POST /assess (API Gateway with API key auth)
    -> Lambda: dpsia-assessor (15 min timeout, 1024MB RAM)
      1. Validate input
      2. Parallel research (9 queries across 3 providers)
         - Perplexity Sonar x3 (factual, citations)
         - Gemini 2.0 Flash x3 (analytical)
         - Grok x3 (contrarian)
      3. Claude synthesis -> structured DPSIA report
      4. Markdown + DOCX generation
      5. Return complete assessment
```

## Quick Start

### Prerequisites

- Node.js 20+
- AWS account with CDK bootstrapped
- API keys: Anthropic, Perplexity, Google (Gemini), xAI (Grok)

### Setup

```bash
npm install
```

### Secrets Setup

Create a secret in AWS Secrets Manager named `dpsia-lambda/config`:

```json
{
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "PERPLEXITY_API_KEY": "pplx-...",
  "GOOGLE_API_KEY": "AI...",
  "XAI_API_KEY": "xai-..."
}
```

### Local Development

Set environment variables for local testing:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export PERPLEXITY_API_KEY=pplx-...
export GOOGLE_API_KEY=AI...
export XAI_API_KEY=xai-...
```

### Build & Test

```bash
npm run build      # Bundle for Lambda
npm test           # Run tests
npm run typecheck  # TypeScript checking
```

### Deploy

```bash
npm run cdk:deploy
```

## API

### POST /assess

**Headers:**
- `x-api-key`: Your API Gateway key
- `Content-Type`: `application/json`

**Request Body:**

```json
{
  "vendorName": "JumpCloud, Inc.",
  "vendorDescription": "Identity & Access Management platform",
  "clientName": "Company, LLC",
  "assessmentType": "annual-review",
  "servicesUsed": "Directory-as-a-Service, MDM, SSO/MFA",
  "dataRole": "Processor",
  "supplierFormContent": null,
  "additionalContext": "Contract renewal May 2026"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendorName` | string | Yes | Legal entity name |
| `vendorDescription` | string | Yes | What the vendor does |
| `clientName` | string | Yes | Client being assessed for |
| `assessmentType` | string | Yes | `new`, `annual-review`, or `adhoc` |
| `servicesUsed` | string | Yes | Services the client uses |
| `dataRole` | string | Yes | `Processor`, `Controller`, or `Joint Controller` |
| `supplierFormContent` | string | No | Raw text of supplier evaluation form |
| `additionalContext` | string | No | Contract details, budget, etc. |

**Response (200):**

```json
{
  "status": "complete",
  "vendorName": "JumpCloud, Inc.",
  "ragStatus": "AMBER",
  "riskScore": 12,
  "riskLevel": "MEDIUM",
  "recommendation": "CONDITIONAL_APPROVAL",
  "executiveSummary": "JumpCloud meets minimum certification bar...",
  "reportMarkdown": "# Data Protection & Security Impact Assessment...",
  "reportDocxBase64": "UEsDBBQAAAAI...",
  "reportFilename": "DPSIA-JumpCloud-2026-02-06.docx",
  "researchSources": ["https://..."],
  "processingTimeMs": 145000
}
```

### Direct Lambda Invocation

For assessments that may exceed the API Gateway 29-second timeout, invoke the Lambda directly:

```bash
aws lambda invoke \
  --function-name DPSIAStack-DPSIAFunction* \
  --payload file://test/fixtures/api-request.json \
  --cli-read-timeout 900 \
  output.json
```

## CLI Usage

A TypeScript CLI script is included for invoking the Lambda and saving results locally.

### Environment Variables (required)

```bash
export AWS_REGION=eu-west-1
export DPSIA_FUNCTION_NAME=DPSIAStack-DPSIAFunction-xxxxxxxxxxxx
```

### Run an Assessment

```bash
npm run assess -- \
  --vendor "JumpCloud, Inc." \
  --description "Identity & Access Management platform" \
  --client "Company, LLC" \
  --type annual-review \
  --services "Directory-as-a-Service, MDM, SSO/MFA" \
  --role Processor \
  --output ./reports
```

### Optional Fields

```bash
npm run assess -- \
  --vendor "Acme Corp" \
  --description "Cloud storage provider" \
  --client "Company, LLC" \
  --type new \
  --services "Object Storage, CDN" \
  --role Processor \
  --context "Contract value $12,000/yr, renewal June 2026" \
  --output ./reports
```

### CLI Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--vendor` | Yes | Vendor legal name |
| `--description` | Yes | What the vendor does |
| `--client` | Yes | Client being assessed for |
| `--type` | Yes | `new`, `annual-review`, or `adhoc` |
| `--services` | Yes | Services used |
| `--role` | Yes | `Processor`, `Controller`, or `Joint Controller` |
| `--context` | No | Additional context (contract, budget, etc.) |
| `--supplier-form` | No | Path to supplier evaluation form (text) |
| `--output` | No | Output directory (default: current directory) |

The CLI invokes the Lambda directly (bypassing API Gateway), so there is no 29-second timeout constraint. Results are saved as both Markdown and DOCX files.

## Report Structure

Generated reports follow the 12-section DPSIA format:

1. Executive Summary (RAG status, recommendation, key findings)
2. Vendor Overview (company info, services, contract)
3. Certification Status (ISO 27001, SOC 2, verification)
4. Breach History & Security Incidents (breaches, CVEs, enforcement)
5. CIA Triad Assessment (confidentiality, integrity, availability)
6. Data Handling (processing, storage, transmission)
7. GDPR Compliance (DPA, data subject rights, transfers)
8. Supplier Evaluation Form Verification
9. Risk Assessment (5x5 matrix, inherent/residual risk)
10. Recommendation (mandatory actions, monitoring)
11. Sources
12. Document Control

## Project Structure

```
src/
  handler.ts              Lambda entry point
  research/
    orchestrator.ts       Parallel multi-provider coordinator
    perplexity.ts         Perplexity Sonar API client
    gemini.ts             Gemini 2.0 Flash API client
    grok.ts               xAI Grok API client
    queries.ts            DPSIA-specific query generator
    types.ts              Research types
  assessment/
    prompt.ts             DPSIA system prompt (from PAI skill)
    runner.ts             Claude API synthesis
    types.ts              DPSIAReport type + I/O schemas
  report/
    markdown.ts           Markdown report generator
    docx.ts               DOCX converter
  utils/
    secrets.ts            Secrets Manager helper with caching
cdk/
  bin/app.ts              CDK app entry point
  lib/dpsia-stack.ts      Lambda + API Gateway + IAM
test/
  handler.test.ts         Integration tests
  research/               Research orchestration tests
  report/                 Report format tests
  fixtures/               Sample payloads
```
