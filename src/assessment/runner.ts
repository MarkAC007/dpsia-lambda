import Anthropic from '@anthropic-ai/sdk';
import type { AssessmentInput, DPSIAReport } from './types.js';
import { DPSIA_SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

export interface RunnerConfig {
  anthropicApiKey: string;
  model?: string;
}

/**
 * Runs the Claude synthesis step.
 * Feeds all research results into Claude with the DPSIA system prompt,
 * receives a structured JSON assessment back.
 */
export async function runAssessment(
  input: AssessmentInput,
  researchText: string,
  config: RunnerConfig,
): Promise<DPSIAReport> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const userPrompt = buildUserPrompt(input, researchText);

  const message = await client.messages.create({
    model: config.model ?? 'claude-sonnet-4-5-20250929',
    max_tokens: 16384,
    system: DPSIA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Extract text content from response
  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  // Parse JSON — Claude may wrap in markdown code fences
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let report: DPSIAReport;
  try {
    report = JSON.parse(jsonText) as DPSIAReport;
  } catch (err) {
    throw new Error(`Failed to parse DPSIA report JSON: ${err instanceof Error ? err.message : String(err)}\n\nRaw response:\n${jsonText.slice(0, 500)}`);
  }

  // Validate critical fields
  if (!report.ragStatus || !['RED', 'AMBER', 'GREEN'].includes(report.ragStatus)) {
    throw new Error(`Invalid ragStatus: ${report.ragStatus}`);
  }
  if (!report.recommendation || !['APPROVE', 'CONDITIONAL_APPROVAL', 'REJECT'].includes(report.recommendation)) {
    throw new Error(`Invalid recommendation: ${report.recommendation}`);
  }

  return report;
}
