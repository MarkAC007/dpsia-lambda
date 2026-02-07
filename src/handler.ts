import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { AssessmentInput, AssessmentOutput } from './assessment/types.js';
import { getSecrets } from './utils/secrets.js';
import { conductResearch, formatResearchForPrompt } from './research/orchestrator.js';
import { runAssessment } from './assessment/runner.js';
import { generateMarkdown } from './report/markdown.js';
import { generateDocx } from './report/docx.js';

const VALID_ASSESSMENT_TYPES = ['new', 'annual-review', 'adhoc'] as const;
const VALID_DATA_ROLES = ['Processor', 'Controller', 'Joint Controller'] as const;

/**
 * Lambda handler for DPSIA assessments.
 *
 * Accepts a vendor assessment request, runs parallel multi-provider research,
 * synthesises findings via Claude, and returns a complete DPSIA report.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const start = Date.now();

  try {
    // Parse and validate input
    const input = parseInput(event);

    // Fetch API keys
    const secrets = await getSecrets();

    // Phase 1: Parallel research (9 queries across 3 providers)
    console.log(`[DPSIA] Starting research for ${input.vendorName}`);
    const research = await conductResearch(
      input.vendorName,
      {
        perplexityApiKey: secrets.PERPLEXITY_API_KEY,
        googleApiKey: secrets.GOOGLE_API_KEY,
        xaiApiKey: secrets.XAI_API_KEY,
        timeoutMs: 90_000,
      },
      input.servicesUsed,
    );
    console.log(`[DPSIA] Research complete: ${research.successCount}/${research.results.length} succeeded in ${research.totalDurationMs}ms`);

    // Phase 2: Claude synthesis
    console.log(`[DPSIA] Starting Claude synthesis`);
    const researchText = formatResearchForPrompt(research);
    const report = await runAssessment(input, researchText, {
      anthropicApiKey: secrets.ANTHROPIC_API_KEY,
    });
    console.log(`[DPSIA] Synthesis complete: ${report.ragStatus} / ${report.recommendation}`);

    // Phase 3: Report generation
    const reportMarkdown = generateMarkdown(input, report);
    const docxBuffer = await generateDocx(input, report);
    const reportDocxBase64 = docxBuffer.toString('base64');

    const vendorSlug = input.vendorName
      .replace(/,?\s*(Inc\.|LLC|Ltd\.?|Corp\.?|GmbH|B\.V\.)$/i, '')
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+$/, '');
    const today = new Date().toISOString().split('T')[0];
    const reportFilename = `DPSIA-${vendorSlug}-${today}.docx`;

    const output: AssessmentOutput = {
      status: 'complete',
      vendorName: input.vendorName,
      ragStatus: report.ragStatus,
      riskScore: report.inherentRiskScore,
      riskLevel: report.inherentRiskLevel,
      recommendation: report.recommendation,
      executiveSummary: report.executiveSummary,
      reportMarkdown,
      reportDocxBase64,
      reportFilename,
      researchSources: research.allSources,
      processingTimeMs: Date.now() - start,
      reportJson: report,
    };

    console.log(`[DPSIA] Complete: ${reportFilename} in ${output.processingTimeMs}ms`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(output),
    };
  } catch (err) {
    console.error('[DPSIA] Error:', err);

    const output: AssessmentOutput = {
      status: 'error',
      vendorName: '',
      ragStatus: 'RED',
      riskScore: 0,
      riskLevel: 'CRITICAL',
      recommendation: 'REJECT',
      executiveSummary: '',
      reportMarkdown: '',
      reportDocxBase64: '',
      reportFilename: '',
      researchSources: [],
      processingTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(output),
    };
  }
}

function parseInput(event: APIGatewayProxyEvent): AssessmentInput {
  if (!event.body) {
    throw new Error('Request body is required');
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body);
  } catch {
    throw new Error('Invalid JSON in request body');
  }

  const vendorName = requireString(body, 'vendorName');
  const vendorDescription = requireString(body, 'vendorDescription');
  const clientName = requireString(body, 'clientName');
  const assessmentType = requireString(body, 'assessmentType');
  const servicesUsed = requireString(body, 'servicesUsed');
  const dataRole = requireString(body, 'dataRole');

  if (!VALID_ASSESSMENT_TYPES.includes(assessmentType as typeof VALID_ASSESSMENT_TYPES[number])) {
    throw new Error(`Invalid assessmentType: ${assessmentType}. Must be one of: ${VALID_ASSESSMENT_TYPES.join(', ')}`);
  }

  if (!VALID_DATA_ROLES.includes(dataRole as typeof VALID_DATA_ROLES[number])) {
    throw new Error(`Invalid dataRole: ${dataRole}. Must be one of: ${VALID_DATA_ROLES.join(', ')}`);
  }

  return {
    vendorName,
    vendorDescription,
    clientName,
    assessmentType: assessmentType as AssessmentInput['assessmentType'],
    servicesUsed,
    dataRole: dataRole as AssessmentInput['dataRole'],
    supplierFormContent: optionalString(body, 'supplierFormContent'),
    additionalContext: optionalString(body, 'additionalContext'),
  };
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or empty required field: ${key}`);
  }
  return value.trim();
}

function optionalString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}
