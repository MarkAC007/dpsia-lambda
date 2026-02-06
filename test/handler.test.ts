import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock external dependencies
vi.mock('../src/utils/secrets.js', () => ({
  getSecrets: vi.fn().mockResolvedValue({
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    PERPLEXITY_API_KEY: 'test-perplexity-key',
    GOOGLE_API_KEY: 'test-google-key',
    XAI_API_KEY: 'test-xai-key',
  }),
}));

vi.mock('../src/research/orchestrator.js', () => ({
  conductResearch: vi.fn().mockResolvedValue({
    results: [
      { provider: 'Perplexity', query: 'test', content: 'Research content', sources: [], success: true, durationMs: 1000 },
    ],
    totalDurationMs: 1000,
    providersUsed: ['Perplexity'],
    allSources: [],
    successCount: 1,
    failureCount: 0,
  }),
  formatResearchForPrompt: vi.fn().mockReturnValue('Formatted research text'),
}));

vi.mock('../src/assessment/runner.js', () => ({
  runAssessment: vi.fn().mockResolvedValue({
    ragStatus: 'AMBER',
    recommendation: 'CONDITIONAL_APPROVAL',
    executiveSummary: 'Test summary',
    keyFindings: ['Finding 1'],
    conditions: ['Condition 1'],
    vendorLegalName: 'TestVendor, Inc.',
    vendorHeadquarters: 'Dublin',
    vendorIndustry: 'SaaS',
    vendorWebsite: 'https://test.com',
    vendorTrustCentre: 'https://test.com/security',
    servicesUsed: [{ service: 'Platform', description: 'Main', dataRole: 'Processor' }],
    certifications: [],
    certificationNotes: '',
    breachHistory: [],
    cveHistory: [],
    enforcementActions: [],
    confidentialityControls: [],
    confidentialityScore: '4/5',
    integrityControls: [],
    integrityScore: '4/5',
    availabilityControls: [],
    availabilityScore: '4/5',
    dataProcessing: {},
    dataStorage: {},
    dataTransmission: {},
    gdprDpa: {},
    gdprDataSubjectRights: {},
    gdprInternationalTransfers: {},
    supplierFormAvailable: false,
    supplierFormVerification: 'Not available',
    inherentRisks: [],
    inherentRiskScore: 6,
    inherentRiskLevel: 'LOW',
    controlEffectiveness: 'Strong',
    controlEffectivenessPercent: 85,
    residualRiskScore: 0.9,
    residualRiskLevel: 'LOW',
    mandatoryActions: [],
    monitoringRequirements: [],
    primarySources: [],
    incidentReports: [],
    thirdPartyAnalysis: [],
    assessmentDate: '2026-02-06',
    assessor: 'DPSIA Lambda (Automated)',
    version: '1.0',
  }),
}));

vi.mock('../src/report/docx.js', () => ({
  generateDocx: vi.fn().mockResolvedValue(Buffer.from('fake-docx-content')),
}));

function makeEvent(body: Record<string, unknown> | null): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/assess',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '/assess',
  };
}

describe('handler', () => {
  let handler: typeof import('../src/handler.js').handler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../src/handler.js');
    handler = mod.handler;
  });

  it('returns 200 with valid input', async () => {
    const event = makeEvent({
      vendorName: 'TestVendor, Inc.',
      vendorDescription: 'A test vendor',
      clientName: 'TestClient, LLC',
      assessmentType: 'annual-review',
      servicesUsed: 'SaaS Platform',
      dataRole: 'Processor',
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.status).toBe('complete');
    expect(body.vendorName).toBe('TestVendor, Inc.');
    expect(body.ragStatus).toBe('AMBER');
    expect(body.reportMarkdown).toContain('Data Protection & Security Impact Assessment');
    expect(body.reportDocxBase64).toBeTruthy();
    expect(body.reportFilename).toMatch(/^DPSIA-TestVendor-\d{4}-\d{2}-\d{2}\.docx$/);
    expect(body.processingTimeMs).toBeGreaterThan(0);
  });

  it('returns 500 with missing body', async () => {
    const event = makeEvent(null);
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.status).toBe('error');
    expect(body.error).toContain('Request body is required');
  });

  it('returns 500 with missing required field', async () => {
    const event = makeEvent({
      vendorName: 'TestVendor',
      // missing other required fields
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.status).toBe('error');
    expect(body.error).toContain('Missing or empty required field');
  });

  it('returns 500 with invalid assessmentType', async () => {
    const event = makeEvent({
      vendorName: 'TestVendor',
      vendorDescription: 'Test',
      clientName: 'TestClient',
      assessmentType: 'invalid',
      servicesUsed: 'Test',
      dataRole: 'Processor',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Invalid assessmentType');
  });

  it('returns 500 with invalid dataRole', async () => {
    const event = makeEvent({
      vendorName: 'TestVendor',
      vendorDescription: 'Test',
      clientName: 'TestClient',
      assessmentType: 'new',
      servicesUsed: 'Test',
      dataRole: 'InvalidRole',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Invalid dataRole');
  });
});
