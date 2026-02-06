#!/usr/bin/env npx tsx
/**
 * DPSIA Assessment CLI
 *
 * Invokes the DPSIA Lambda, waits for completion, and saves the results.
 *
 * Usage:
 *   npx tsx scripts/assess.ts \
 *     --vendor "JumpCloud, Inc." \
 *     --description "Identity & Access Management platform" \
 *     --client "Your Company, LLC" \
 *     --type annual-review \
 *     --services "Directory-as-a-Service, MDM, SSO/MFA" \
 *     --role Processor \
 *     --output ./reports
 *
 *   # With optional fields:
 *   npx tsx scripts/assess.ts \
 *     --vendor "Acme Corp" \
 *     --description "Cloud storage provider" \
 *     --client "Your Company, LLC" \
 *     --type new \
 *     --services "Object Storage, CDN" \
 *     --role Processor \
 *     --context "Contract value $12,000/yr, renewal June 2026" \
 *     --output ./reports
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AssessmentInput, AssessmentOutput } from '../src/assessment/types.js';

// --- Configuration (all from environment — no hardcoded values) ---
const FUNCTION_NAME = process.env.DPSIA_FUNCTION_NAME;
const REGION = process.env.AWS_REGION;

if (!FUNCTION_NAME) {
  console.error('\x1b[31mDPSIA_FUNCTION_NAME environment variable is required.\x1b[0m');
  console.error('Set it to your deployed Lambda function name, e.g.:');
  console.error('  export DPSIA_FUNCTION_NAME=DPSIAStack-DPSIAFunction-xxxxxxxxxxxx\n');
  process.exit(1);
}
if (!REGION) {
  console.error('\x1b[31mAWS_REGION environment variable is required.\x1b[0m');
  console.error('Set it to the region where your Lambda is deployed, e.g.:');
  console.error('  export AWS_REGION=eu-west-1\n');
  process.exit(1);
}

// --- Argument parsing ---
interface CLIArgs {
  vendor: string;
  description: string;
  client: string;
  type: string;
  services: string;
  role: string;
  context?: string;
  supplierForm?: string;
  output: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') && i + 1 < args.length) {
      const key = arg.slice(2);
      parsed[key] = args[++i];
    } else if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    }
  }

  const required = ['vendor', 'description', 'client', 'type', 'services', 'role'];
  const missing = required.filter(k => !parsed[k]);
  if (missing.length > 0) {
    console.error(`\x1b[31mMissing required arguments: ${missing.map(k => `--${k}`).join(', ')}\x1b[0m\n`);
    printUsage();
    process.exit(1);
  }

  const validTypes = ['new', 'annual-review', 'adhoc'];
  if (!validTypes.includes(parsed.type)) {
    console.error(`\x1b[31mInvalid --type: ${parsed.type}. Must be: ${validTypes.join(', ')}\x1b[0m`);
    process.exit(1);
  }

  const validRoles = ['Processor', 'Controller', 'Joint Controller'];
  if (!validRoles.includes(parsed.role)) {
    console.error(`\x1b[31mInvalid --role: ${parsed.role}. Must be: ${validRoles.join(', ')}\x1b[0m`);
    process.exit(1);
  }

  return {
    vendor: parsed.vendor,
    description: parsed.description,
    client: parsed.client,
    type: parsed.type,
    services: parsed.services,
    role: parsed.role,
    context: parsed.context,
    supplierForm: parsed['supplier-form'],
    output: parsed.output ?? '.',
  };
}

function printUsage(): void {
  console.log(`
\x1b[1mDPSIA Assessment CLI\x1b[0m

Invokes the DPSIA Lambda to perform a vendor security assessment.

\x1b[1mUsage:\x1b[0m
  npx tsx scripts/assess.ts [options]

\x1b[1mRequired:\x1b[0m
  --vendor        Vendor legal name (e.g. "JumpCloud, Inc.")
  --description   What the vendor does
  --client        Client being assessed for (e.g. "Your Company, LLC")
  --type          Assessment type: new | annual-review | adhoc
  --services      Services used (e.g. "SSO, MDM, Directory")
  --role          Data role: Processor | Controller | Joint Controller

\x1b[1mOptional:\x1b[0m
  --context       Additional context (contract details, budget, etc.)
  --supplier-form Path to supplier evaluation form (text file)
  --output        Output directory for reports (default: current dir)

\x1b[1mEnvironment (required):\x1b[0m
  AWS_REGION            AWS region where Lambda is deployed
  DPSIA_FUNCTION_NAME   Lambda function name

\x1b[1mEnvironment (optional):\x1b[0m
  AWS_PROFILE           AWS credentials profile
`);
}

// --- Lambda invocation ---
async function invokeLambda(input: AssessmentInput): Promise<AssessmentOutput> {
  const client = new LambdaClient({ region: REGION });

  // Wrap in API Gateway event format
  const event = {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    httpMethod: 'POST',
    path: '/assess',
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      resourceId: 'cli',
      resourcePath: '/assess',
      httpMethod: 'POST',
      requestId: `cli-${Date.now()}`,
    },
    resource: '/assess',
  };

  const command = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: Buffer.from(JSON.stringify(event)),
  });

  const response = await client.send(command);

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : { errorMessage: 'Unknown Lambda error' };
    throw new Error(`Lambda error: ${errorPayload.errorMessage ?? JSON.stringify(errorPayload)}`);
  }

  if (!response.Payload) {
    throw new Error('Empty Lambda response');
  }

  const apiGatewayResponse = JSON.parse(Buffer.from(response.Payload).toString());
  return JSON.parse(apiGatewayResponse.body) as AssessmentOutput;
}

// --- Result processing ---
function saveResults(result: AssessmentOutput, outputDir: string): { mdPath: string; docxPath: string } {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const mdPath = join(outputDir, result.reportFilename.replace('.docx', '.md'));
  const docxPath = join(outputDir, result.reportFilename);

  // Save markdown
  writeFileSync(mdPath, result.reportMarkdown, 'utf-8');

  // Decode and save DOCX
  const docxBuffer = Buffer.from(result.reportDocxBase64, 'base64');
  writeFileSync(docxPath, docxBuffer);

  return { mdPath, docxPath };
}

function printSummary(result: AssessmentOutput, paths: { mdPath: string; docxPath: string }): void {
  const ragColour = result.ragStatus === 'RED' ? '\x1b[31m'
    : result.ragStatus === 'AMBER' ? '\x1b[33m'
    : '\x1b[32m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';

  console.log(`
${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}
${bold}  DPSIA Assessment Complete${reset}
${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${bold}Vendor:${reset}          ${result.vendorName}
  ${bold}RAG Status:${reset}      ${ragColour}${bold}${result.ragStatus}${reset}
  ${bold}Risk Score:${reset}      ${result.riskScore}/25 (${result.riskLevel})
  ${bold}Recommendation:${reset}  ${result.recommendation.replace('_', ' ')}
  ${bold}Processing:${reset}      ${(result.processingTimeMs / 1000).toFixed(1)}s
  ${bold}Sources:${reset}         ${result.researchSources.length}

  ${bold}Executive Summary:${reset}
  ${dim}${result.executiveSummary}${reset}

  ${bold}Reports saved:${reset}
  ${dim}Markdown:${reset} ${paths.mdPath}
  ${dim}Word:${reset}     ${paths.docxPath}

${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}
`);
}

// --- Main ---
async function main(): Promise<void> {
  const args = parseArgs();

  const input: AssessmentInput = {
    vendorName: args.vendor,
    vendorDescription: args.description,
    clientName: args.client,
    assessmentType: args.type as AssessmentInput['assessmentType'],
    servicesUsed: args.services,
    dataRole: args.role as AssessmentInput['dataRole'],
    supplierFormContent: args.supplierForm ?? null,
    additionalContext: args.context ?? null,
  };

  console.log(`\x1b[1mDPSIA Assessment\x1b[0m — ${input.vendorName}`);
  console.log(`\x1b[2mInvoking Lambda (this takes 2-4 minutes)...\x1b[0m\n`);

  const startTime = Date.now();

  // Show a progress indicator
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinIdx = 0;
  const interval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`\r  ${spinner[spinIdx++ % spinner.length]} Researching and analysing... ${elapsed}s`);
  }, 100);

  try {
    const result = await invokeLambda(input);
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');

    if (result.status === 'error') {
      console.error(`\x1b[31mAssessment failed: ${result.error}\x1b[0m`);
      process.exit(1);
    }

    const paths = saveResults(result, args.output);
    printSummary(result, paths);
  } catch (err) {
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
    console.error(`\x1b[31mError: ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
    process.exit(1);
  }
}

main();
