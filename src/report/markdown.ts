import type { AssessmentInput, DPSIAReport } from '../assessment/types.js';

const RAG_EMOJI: Record<string, string> = {
  RED: '\u{1F534}',    // red circle
  AMBER: '\u{1F7E1}',  // yellow circle
  GREEN: '\u{1F7E2}',  // green circle
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  APPROVE: 'APPROVAL',
  CONDITIONAL_APPROVAL: 'CONDITIONAL APPROVAL',
  REJECT: 'REJECTION',
};

/**
 * Generates a markdown DPSIA report matching the exact format of existing reports.
 * Mirrors the 12-section structure from DPSIA-jumpcloud-2026-01-15.md.
 */
export function generateMarkdown(input: AssessmentInput, report: DPSIAReport): string {
  const ragEmoji = RAG_EMOJI[report.ragStatus] ?? '';
  const recLabel = RECOMMENDATION_LABEL[report.recommendation] ?? report.recommendation;
  const lines: string[] = [];

  // Header
  lines.push('# Data Protection & Security Impact Assessment (DPSIA)');
  lines.push('');
  lines.push(`## Vendor: ${report.vendorLegalName}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| **Assessment Date** | ${report.assessmentDate} |`);
  lines.push(`| **Assessor** | ${report.assessor} |`);
  lines.push(`| **Client** | ${input.clientName} |`);
  lines.push(`| **Assessment Type** | ${formatAssessmentType(input.assessmentType)} |`);
  lines.push(`| **RAG Status** | ${ragEmoji} ${report.ragStatus} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 1: Executive Summary
  lines.push('## 1. Executive Summary');
  lines.push('');
  lines.push(`### Recommendation: ${recLabel}`);
  lines.push('');
  lines.push(report.executiveSummary);
  lines.push('');
  lines.push('**Key Findings:**');
  for (const finding of report.keyFindings) {
    lines.push(`- ${finding}`);
  }
  lines.push('');

  if (report.conditions.length > 0) {
    lines.push('**Conditions for Continued Use:**');
    for (let i = 0; i < report.conditions.length; i++) {
      lines.push(`${i + 1}. ${report.conditions[i]}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 2: Vendor Overview
  lines.push('## 2. Vendor Overview');
  lines.push('');
  lines.push('### Company Information');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| **Legal Name** | ${report.vendorLegalName} |`);
  lines.push(`| **Headquarters** | ${report.vendorHeadquarters} |`);
  lines.push(`| **Industry** | ${report.vendorIndustry} |`);
  lines.push(`| **Website** | ${report.vendorWebsite} |`);
  lines.push(`| **Trust Centre** | ${report.vendorTrustCentre} |`);
  lines.push('');

  lines.push(`### Services Used by ${input.clientName}`);
  lines.push('');
  lines.push('| Service | Description | Data Role |');
  lines.push('|---------|-------------|-----------|');
  for (const svc of report.servicesUsed) {
    lines.push(`| ${svc.service} | ${svc.description} | ${svc.dataRole} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 3: Certification Status
  lines.push('## 3. Certification Status');
  lines.push('');
  lines.push('### Minimum Bar Assessment');
  lines.push('');
  lines.push('| Certification | Status | Valid Until | Evidence |');
  lines.push('|---------------|--------|-------------|----------|');
  for (const cert of report.certifications) {
    lines.push(`| **${cert.name}** | ${cert.status} | ${cert.validUntil} | ${cert.evidence} |`);
  }
  lines.push('');

  if (report.certificationNotes) {
    lines.push('**Certification Notes:**');
    lines.push(report.certificationNotes);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 4: Breach History
  lines.push('## 4. Breach History & Security Incidents');
  lines.push('');

  if (report.breachHistory.length > 0) {
    for (const breach of report.breachHistory) {
      lines.push(`### ${breach.description}`);
      lines.push('');
      lines.push('| Field | Details |');
      lines.push('|-------|---------|');
      lines.push(`| **Date** | ${breach.date} |`);
      lines.push(`| **Impact** | ${breach.impact} |`);
      lines.push(`| **Status** | ${breach.status} |`);
      lines.push('');
    }
  } else {
    lines.push('No significant breach history identified.');
    lines.push('');
  }

  if (report.cveHistory.length > 0) {
    lines.push('### CVE History');
    lines.push('');
    lines.push('| CVE | Severity | CVSS | Description | Status |');
    lines.push('|-----|----------|------|-------------|--------|');
    for (const cve of report.cveHistory) {
      lines.push(`| **${cve.cve}** | ${cve.severity} | ${cve.cvss} | ${cve.description} | ${cve.status} |`);
    }
    lines.push('');
  }

  lines.push('### Enforcement Actions');
  lines.push('');
  lines.push('| Authority | Action | Status |');
  lines.push('|-----------|--------|--------|');
  for (const ea of report.enforcementActions) {
    lines.push(`| ${ea.authority} | ${ea.action} | ${ea.status} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 5: CIA Triad
  lines.push('## 5. CIA Triad Assessment');
  lines.push('');

  lines.push('### Confidentiality');
  lines.push('');
  lines.push('| Control | Implementation | Rating |');
  lines.push('|---------|----------------|--------|');
  for (const c of report.confidentialityControls) {
    lines.push(`| **${c.control}** | ${c.implementation} | ${c.rating} |`);
  }
  lines.push('');
  lines.push(`**Confidentiality Score: ${report.confidentialityScore}**`);
  lines.push('');

  lines.push('### Integrity');
  lines.push('');
  lines.push('| Control | Implementation | Rating |');
  lines.push('|---------|----------------|--------|');
  for (const c of report.integrityControls) {
    lines.push(`| **${c.control}** | ${c.implementation} | ${c.rating} |`);
  }
  lines.push('');
  lines.push(`**Integrity Score: ${report.integrityScore}**`);
  lines.push('');

  lines.push('### Availability');
  lines.push('');
  lines.push('| Control | Implementation | Rating |');
  lines.push('|---------|----------------|--------|');
  for (const c of report.availabilityControls) {
    lines.push(`| **${c.control}** | ${c.implementation} | ${c.rating} |`);
  }
  lines.push('');
  lines.push(`**Availability Score: ${report.availabilityScore}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 6: Data Handling
  lines.push('## 6. Data Handling Assessment');
  lines.push('');
  lines.push('### Data Processing');
  lines.push('');
  lines.push('| Question | Answer |');
  lines.push('|----------|--------|');
  for (const [q, a] of Object.entries(report.dataProcessing)) {
    lines.push(`| **${q}** | ${a} |`);
  }
  lines.push('');

  lines.push('### Data Storage');
  lines.push('');
  lines.push('| Question | Answer |');
  lines.push('|----------|--------|');
  for (const [q, a] of Object.entries(report.dataStorage)) {
    lines.push(`| **${q}** | ${a} |`);
  }
  lines.push('');

  lines.push('### Data Transmission');
  lines.push('');
  lines.push('| Question | Answer |');
  lines.push('|----------|--------|');
  for (const [q, a] of Object.entries(report.dataTransmission)) {
    lines.push(`| **${q}** | ${a} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 7: GDPR Compliance
  lines.push('## 7. GDPR Compliance');
  lines.push('');
  lines.push('### Data Processing Agreement');
  lines.push('');
  lines.push('| Element | Status |');
  lines.push('|---------|--------|');
  for (const [k, v] of Object.entries(report.gdprDpa)) {
    lines.push(`| **${k}** | ${v} |`);
  }
  lines.push('');

  lines.push('### Data Subject Rights');
  lines.push('');
  lines.push('| Right | Supported |');
  lines.push('|-------|-----------|');
  for (const [k, v] of Object.entries(report.gdprDataSubjectRights)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('### International Transfers');
  lines.push('');
  lines.push('| Mechanism | Status |');
  lines.push('|-----------|--------|');
  for (const [k, v] of Object.entries(report.gdprInternationalTransfers)) {
    lines.push(`| **${k}** | ${v} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 8: Supplier Form Verification
  lines.push('## 8. Supplier Evaluation Form Verification');
  lines.push('');
  lines.push('| Element | Status |');
  lines.push('|---------|--------|');
  lines.push(`| **Form Available** | ${report.supplierFormAvailable ? '\u2705 Yes' : '\u274C Not found'} |`);
  lines.push(`| **Independent Verification** | \u2705 Completed via public sources |`);
  lines.push('');
  lines.push(report.supplierFormVerification);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 9: Risk Assessment
  lines.push('## 9. Risk Assessment');
  lines.push('');
  lines.push('### Inherent Risk');
  lines.push('');
  lines.push('| Factor | Likelihood | Impact | Score |');
  lines.push('|--------|------------|--------|-------|');
  for (const risk of report.inherentRisks) {
    lines.push(`| ${risk.factor} | ${risk.likelihood} (${risk.likelihoodLabel}) | ${risk.impact} (${risk.impactLabel}) | ${risk.score} |`);
  }
  lines.push('');
  lines.push(`**Inherent Risk Score: ${report.inherentRiskScore} (${report.inherentRiskLevel})**`);
  lines.push('');

  lines.push('### Control Effectiveness');
  lines.push('');
  lines.push(report.controlEffectiveness);
  lines.push('');
  lines.push(`**Control Effectiveness: ${report.controlEffectivenessPercent}%**`);
  lines.push('');

  lines.push('### Residual Risk');
  lines.push('');
  lines.push('| Calculation | Value |');
  lines.push('|-------------|-------|');
  lines.push(`| Inherent Risk | ${report.inherentRiskScore} |`);
  lines.push(`| Control Effectiveness | ${report.controlEffectivenessPercent}% |`);
  lines.push(`| **Residual Risk** | **${report.residualRiskScore} (${report.residualRiskLevel})** |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 10: Recommendation
  lines.push('## 10. Recommendation');
  lines.push('');
  lines.push(`### Decision: ${ragEmoji} ${recLabel}`);
  lines.push('');

  if (report.mandatoryActions.length > 0) {
    lines.push('### Mandatory Actions');
    lines.push('');
    lines.push('| # | Action | Owner | Due Date | Priority |');
    lines.push('|---|--------|-------|----------|----------|');
    for (const action of report.mandatoryActions) {
      lines.push(`| ${action.number} | ${action.action} | ${action.owner} | ${action.dueDate} | ${action.priority} |`);
    }
    lines.push('');
  }

  if (report.monitoringRequirements.length > 0) {
    lines.push('### Monitoring Requirements');
    lines.push('');
    for (const req of report.monitoringRequirements) {
      lines.push(`- ${req}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 11: Sources
  lines.push('## 11. Sources');
  lines.push('');

  if (report.primarySources.length > 0) {
    lines.push('### Primary Sources');
    for (const src of report.primarySources) {
      lines.push(`- ${src}`);
    }
    lines.push('');
  }

  if (report.incidentReports.length > 0) {
    lines.push('### Incident Reports');
    for (const src of report.incidentReports) {
      lines.push(`- ${src}`);
    }
    lines.push('');
  }

  if (report.thirdPartyAnalysis.length > 0) {
    lines.push('### Third-Party Analysis');
    for (const src of report.thirdPartyAnalysis) {
      lines.push(`- ${src}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 12: Document Control
  lines.push('## 12. Document Control');
  lines.push('');
  lines.push('| Version | Date | Author | Changes |');
  lines.push('|---------|------|--------|---------|');
  lines.push(`| ${report.version} | ${report.assessmentDate} | ${report.assessor} | Automated assessment |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*This DPSIA was generated as part of ${input.clientName}'s third-party risk management programme.*`);
  lines.push('');

  return lines.join('\n');
}

function formatAssessmentType(type: string): string {
  switch (type) {
    case 'new': return 'New Vendor Assessment';
    case 'annual-review': return 'Annual Review';
    case 'adhoc': return 'Adhoc Assessment';
    default: return type;
  }
}
