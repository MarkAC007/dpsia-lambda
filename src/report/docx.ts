import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';
import type { AssessmentInput, DPSIAReport } from '../assessment/types.js';

const RAG_LABEL: Record<string, string> = {
  RED: 'RED',
  AMBER: 'AMBER',
  GREEN: 'GREEN',
};

const REC_LABEL: Record<string, string> = {
  APPROVE: 'APPROVAL',
  CONDITIONAL_APPROVAL: 'CONDITIONAL APPROVAL',
  REJECT: 'REJECTION',
};

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function para(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text ?? '', bold })],
    spacing: { after: 80 },
  });
}

function tableBorders() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
  return { top: border, bottom: border, left: border, right: border };
}

function kvTable(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [para('Field', true)], width: { size: 30, type: WidthType.PERCENTAGE }, borders: tableBorders() }),
          new TableCell({ children: [para('Value', true)], width: { size: 70, type: WidthType.PERCENTAGE }, borders: tableBorders() }),
        ],
      }),
      ...rows.map(([k, v]) => new TableRow({
        children: [
          new TableCell({ children: [para(k, true)], borders: tableBorders() }),
          new TableCell({ children: [para(v)], borders: tableBorders() }),
        ],
      })),
    ],
  });
}

function multiColTable(headers: string[], rows: string[][]): Table {
  const colWidth = Math.floor(100 / headers.length);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(h => new TableCell({
          children: [para(h, true)],
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          borders: tableBorders(),
        })),
      }),
      ...rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
          children: [para(cell)],
          borders: tableBorders(),
        })),
      })),
    ],
  });
}

/**
 * Generate a DOCX buffer from a DPSIA report.
 * Returns a Buffer that can be base64-encoded for the API response.
 */
export async function generateDocx(input: AssessmentInput, report: DPSIAReport): Promise<Buffer> {
  const ragLabel = RAG_LABEL[report.ragStatus] ?? report.ragStatus;
  const recLabel = REC_LABEL[report.recommendation] ?? report.recommendation;

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(heading('Data Protection & Security Impact Assessment (DPSIA)'));
  children.push(heading(`Vendor: ${report.vendorLegalName}`, HeadingLevel.HEADING_2));
  children.push(kvTable([
    ['Assessment Date', report.assessmentDate],
    ['Assessor', report.assessor],
    ['Client', input.clientName],
    ['Assessment Type', input.assessmentType],
    ['RAG Status', ragLabel],
  ]));

  // Section 1: Executive Summary
  children.push(heading('1. Executive Summary', HeadingLevel.HEADING_2));
  children.push(para(`Recommendation: ${recLabel}`, true));
  children.push(para(report.executiveSummary));
  children.push(para('Key Findings:', true));
  for (const finding of report.keyFindings) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `  ${finding}` })],
      spacing: { after: 40 },
    }));
  }

  if (report.conditions.length > 0) {
    children.push(para('Conditions for Continued Use:', true));
    report.conditions.forEach((c, i) => {
      children.push(para(`${i + 1}. ${c}`));
    });
  }

  // Section 2: Vendor Overview
  children.push(heading('2. Vendor Overview', HeadingLevel.HEADING_2));
  children.push(kvTable([
    ['Legal Name', report.vendorLegalName],
    ['Headquarters', report.vendorHeadquarters],
    ['Industry', report.vendorIndustry],
    ['Website', report.vendorWebsite],
    ['Trust Centre', report.vendorTrustCentre],
  ]));

  children.push(para(`Services Used by ${input.clientName}`, true));
  children.push(multiColTable(
    ['Service', 'Description', 'Data Role'],
    report.servicesUsed.map(s => [s.service, s.description, s.dataRole]),
  ));

  // Section 3: Certifications
  children.push(heading('3. Certification Status', HeadingLevel.HEADING_2));
  children.push(multiColTable(
    ['Certification', 'Status', 'Valid Until', 'Evidence'],
    report.certifications.map(c => [c.name, c.status, c.validUntil, c.evidence]),
  ));
  if (report.certificationNotes) {
    children.push(para(report.certificationNotes));
  }

  // Section 4: Breach History
  children.push(heading('4. Breach History & Security Incidents', HeadingLevel.HEADING_2));
  if (report.breachHistory.length > 0) {
    for (const b of report.breachHistory) {
      children.push(para(b.description, true));
      children.push(kvTable([
        ['Date', b.date],
        ['Impact', b.impact],
        ['Status', b.status],
      ]));
    }
  } else {
    children.push(para('No significant breach history identified.'));
  }

  if (report.cveHistory.length > 0) {
    children.push(para('CVE History', true));
    children.push(multiColTable(
      ['CVE', 'Severity', 'CVSS', 'Description', 'Status'],
      report.cveHistory.map(c => [c.cve, c.severity, c.cvss, c.description, c.status]),
    ));
  }

  children.push(para('Enforcement Actions', true));
  children.push(multiColTable(
    ['Authority', 'Action', 'Status'],
    report.enforcementActions.map(e => [e.authority, e.action, e.status]),
  ));

  // Section 5: CIA Triad
  children.push(heading('5. CIA Triad Assessment', HeadingLevel.HEADING_2));

  children.push(para('Confidentiality', true));
  children.push(multiColTable(
    ['Control', 'Implementation', 'Rating'],
    report.confidentialityControls.map(c => [c.control, c.implementation, c.rating]),
  ));
  children.push(para(`Confidentiality Score: ${report.confidentialityScore}`));

  children.push(para('Integrity', true));
  children.push(multiColTable(
    ['Control', 'Implementation', 'Rating'],
    report.integrityControls.map(c => [c.control, c.implementation, c.rating]),
  ));
  children.push(para(`Integrity Score: ${report.integrityScore}`));

  children.push(para('Availability', true));
  children.push(multiColTable(
    ['Control', 'Implementation', 'Rating'],
    report.availabilityControls.map(c => [c.control, c.implementation, c.rating]),
  ));
  children.push(para(`Availability Score: ${report.availabilityScore}`));

  // Section 6: Data Handling
  children.push(heading('6. Data Handling Assessment', HeadingLevel.HEADING_2));
  children.push(para('Data Processing', true));
  children.push(kvTable(Object.entries(report.dataProcessing)));
  children.push(para('Data Storage', true));
  children.push(kvTable(Object.entries(report.dataStorage)));
  children.push(para('Data Transmission', true));
  children.push(kvTable(Object.entries(report.dataTransmission)));

  // Section 7: GDPR
  children.push(heading('7. GDPR Compliance', HeadingLevel.HEADING_2));
  children.push(para('Data Processing Agreement', true));
  children.push(kvTable(Object.entries(report.gdprDpa)));
  children.push(para('Data Subject Rights', true));
  children.push(kvTable(Object.entries(report.gdprDataSubjectRights)));
  children.push(para('International Transfers', true));
  children.push(kvTable(Object.entries(report.gdprInternationalTransfers)));

  // Section 8: Supplier Form
  children.push(heading('8. Supplier Evaluation Form Verification', HeadingLevel.HEADING_2));
  children.push(para(`Form Available: ${report.supplierFormAvailable ? 'Yes' : 'Not found'}`));
  children.push(para(report.supplierFormVerification));

  // Section 9: Risk Assessment
  children.push(heading('9. Risk Assessment', HeadingLevel.HEADING_2));
  children.push(para('Inherent Risk', true));
  children.push(multiColTable(
    ['Factor', 'Likelihood', 'Impact', 'Score'],
    report.inherentRisks.map(r => [
      r.factor,
      `${r.likelihood} (${r.likelihoodLabel})`,
      `${r.impact} (${r.impactLabel})`,
      String(r.score),
    ]),
  ));
  children.push(para(`Inherent Risk Score: ${report.inherentRiskScore} (${report.inherentRiskLevel})`, true));
  children.push(para(report.controlEffectiveness));
  children.push(para(`Control Effectiveness: ${report.controlEffectivenessPercent}%`, true));
  children.push(para(`Residual Risk: ${report.residualRiskScore} (${report.residualRiskLevel})`, true));

  // Section 10: Recommendation
  children.push(heading('10. Recommendation', HeadingLevel.HEADING_2));
  children.push(para(`Decision: ${recLabel}`, true));

  if (report.mandatoryActions.length > 0) {
    children.push(para('Mandatory Actions', true));
    children.push(multiColTable(
      ['#', 'Action', 'Owner', 'Due Date', 'Priority'],
      report.mandatoryActions.map(a => [
        String(a.number), a.action, a.owner, a.dueDate, a.priority,
      ]),
    ));
  }

  if (report.monitoringRequirements.length > 0) {
    children.push(para('Monitoring Requirements', true));
    for (const req of report.monitoringRequirements) {
      children.push(para(`- ${req}`));
    }
  }

  // Section 11: Sources
  children.push(heading('11. Sources', HeadingLevel.HEADING_2));
  const allSources = [
    ...report.primarySources,
    ...report.incidentReports,
    ...report.thirdPartyAnalysis,
  ];
  for (const src of allSources) {
    children.push(para(`- ${src}`));
  }

  // Section 12: Document Control
  children.push(heading('12. Document Control', HeadingLevel.HEADING_2));
  children.push(multiColTable(
    ['Version', 'Date', 'Author', 'Changes'],
    [[report.version, report.assessmentDate, report.assessor, 'Automated assessment']],
  ));

  children.push(para(`This DPSIA was generated as part of ${input.clientName}'s third-party risk management programme.`));

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
