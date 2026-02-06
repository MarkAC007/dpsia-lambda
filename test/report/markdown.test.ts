import { describe, it, expect } from 'vitest';
import { generateMarkdown } from '../../src/report/markdown.js';
import type { AssessmentInput, DPSIAReport } from '../../src/assessment/types.js';

function makeInput(): AssessmentInput {
  return {
    vendorName: 'TestVendor, Inc.',
    vendorDescription: 'A test vendor',
    clientName: 'TestClient, LLC',
    assessmentType: 'annual-review',
    servicesUsed: 'SaaS Platform',
    dataRole: 'Processor',
  };
}

function makeReport(): DPSIAReport {
  return {
    ragStatus: 'AMBER',
    recommendation: 'CONDITIONAL_APPROVAL',
    executiveSummary: 'TestVendor meets minimum certification bar.',
    keyFindings: ['ISO 27001 certified', 'SOC 2 Type II attested', 'One minor CVE'],
    conditions: ['Verify agent versions', 'Annual review'],
    vendorLegalName: 'TestVendor, Inc.',
    vendorHeadquarters: 'Dublin, Ireland',
    vendorIndustry: 'SaaS',
    vendorWebsite: 'https://testvendor.com',
    vendorTrustCentre: 'https://testvendor.com/security',
    servicesUsed: [{ service: 'Platform', description: 'Main SaaS', dataRole: 'Processor' }],
    certifications: [
      { name: 'ISO 27001', status: 'CERTIFIED', validUntil: '2027-01-01', evidence: 'Certificate on file' },
      { name: 'SOC 2 Type II', status: 'ATTESTED', validUntil: '2027-06-01', evidence: 'Report available' },
    ],
    certificationNotes: 'Both certifications verified via public sources.',
    breachHistory: [],
    cveHistory: [{ cve: 'CVE-2025-12345', severity: 'MEDIUM', cvss: '5.3', description: 'Minor XSS', status: 'Patched' }],
    enforcementActions: [
      { authority: 'ICO (UK)', action: 'No actions found', status: 'Clear' },
    ],
    confidentialityControls: [{ control: 'Encryption at Rest', implementation: 'AES-256', rating: 'Strong' }],
    confidentialityScore: '4/5',
    integrityControls: [{ control: 'Change Management', implementation: 'Full CI/CD pipeline', rating: 'Strong' }],
    integrityScore: '4/5',
    availabilityControls: [{ control: 'Multi-AZ', implementation: 'AWS multi-AZ', rating: 'Strong' }],
    availabilityScore: '4/5',
    dataProcessing: { 'What data is processed?': 'User accounts', 'Lawful basis': 'Contract performance' },
    dataStorage: { 'Primary location': 'EU (Ireland)', 'Encryption at rest': 'Yes' },
    dataTransmission: { 'Encryption in transit': 'TLS 1.2+' },
    gdprDpa: { 'DPA Available': 'Yes', 'SCCs Included': 'Yes' },
    gdprDataSubjectRights: { 'Access': 'Yes', 'Erasure': 'Yes' },
    gdprInternationalTransfers: { 'Transfer Basis': 'SCCs' },
    supplierFormAvailable: false,
    supplierFormVerification: 'No Supplier Evaluation Form was located. Assessment based on independent research.',
    inherentRisks: [{ factor: 'Data breach', likelihood: 2, likelihoodLabel: 'Unlikely', impact: 3, impactLabel: 'Moderate', score: 6 }],
    inherentRiskScore: 6,
    inherentRiskLevel: 'LOW',
    controlEffectiveness: 'Strong controls across all areas.',
    controlEffectivenessPercent: 85,
    residualRiskScore: 0.9,
    residualRiskLevel: 'LOW',
    mandatoryActions: [{ number: 1, action: 'Annual review', owner: 'GRC Team', dueDate: '2027-02-01', priority: 'Medium' }],
    monitoringRequirements: ['Annual DPSIA review'],
    primarySources: ['https://testvendor.com/security'],
    incidentReports: [],
    thirdPartyAnalysis: [],
    assessmentDate: '2026-02-06',
    assessor: 'DPSIA Lambda (Automated)',
    version: '1.0',
  };
}

describe('generateMarkdown', () => {
  it('generates valid markdown with all 12 sections', () => {
    const md = generateMarkdown(makeInput(), makeReport());

    // Check all 12 section headings
    expect(md).toContain('## 1. Executive Summary');
    expect(md).toContain('## 2. Vendor Overview');
    expect(md).toContain('## 3. Certification Status');
    expect(md).toContain('## 4. Breach History & Security Incidents');
    expect(md).toContain('## 5. CIA Triad Assessment');
    expect(md).toContain('## 6. Data Handling Assessment');
    expect(md).toContain('## 7. GDPR Compliance');
    expect(md).toContain('## 8. Supplier Evaluation Form Verification');
    expect(md).toContain('## 9. Risk Assessment');
    expect(md).toContain('## 10. Recommendation');
    expect(md).toContain('## 11. Sources');
    expect(md).toContain('## 12. Document Control');
  });

  it('includes the DPSIA title', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain('# Data Protection & Security Impact Assessment (DPSIA)');
  });

  it('displays RAG status with emoji', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain('AMBER');
  });

  it('includes vendor overview table', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain('| **Legal Name** | TestVendor, Inc. |');
    expect(md).toContain('| **Headquarters** | Dublin, Ireland |');
  });

  it('lists certifications in table format', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain('| **ISO 27001** | CERTIFIED |');
    expect(md).toContain('| **SOC 2 Type II** | ATTESTED |');
  });

  it('includes risk assessment with scores', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain('**Inherent Risk Score: 6 (LOW)**');
    expect(md).toContain('**Control Effectiveness: 85%**');
  });

  it('formats assessment type correctly', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain('Annual Review');
  });

  it('includes the programme footer', () => {
    const md = generateMarkdown(makeInput(), makeReport());
    expect(md).toContain("TestClient, LLC's third-party risk management programme");
  });

  it('handles APPROVE recommendation', () => {
    const report = makeReport();
    report.recommendation = 'APPROVE';
    report.ragStatus = 'GREEN';
    report.conditions = [];
    const md = generateMarkdown(makeInput(), report);
    expect(md).toContain('### Recommendation: APPROVAL');
    expect(md).not.toContain('Conditions for Continued Use');
  });

  it('handles REJECT recommendation', () => {
    const report = makeReport();
    report.recommendation = 'REJECT';
    report.ragStatus = 'RED';
    const md = generateMarkdown(makeInput(), report);
    expect(md).toContain('### Recommendation: REJECTION');
  });
});
