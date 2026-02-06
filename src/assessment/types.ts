// --- Input types ---

export type AssessmentType = 'new' | 'annual-review' | 'adhoc';
export type DataRole = 'Processor' | 'Controller' | 'Joint Controller';
export type RAGStatus = 'RED' | 'AMBER' | 'GREEN';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Recommendation = 'APPROVE' | 'CONDITIONAL_APPROVAL' | 'REJECT';

export interface AssessmentInput {
  vendorName: string;
  vendorDescription: string;
  clientName: string;
  assessmentType: AssessmentType;
  servicesUsed: string;
  dataRole: DataRole;
  supplierFormContent?: string | null;
  additionalContext?: string | null;
}

// --- Output types ---

export interface CertificationEntry {
  name: string;
  status: string;
  validUntil: string;
  evidence: string;
}

export interface BreachEntry {
  date: string;
  description: string;
  impact: string;
  status: string;
}

export interface CVEEntry {
  cve: string;
  severity: string;
  cvss: string;
  description: string;
  status: string;
}

export interface CIAControl {
  control: string;
  implementation: string;
  rating: string;
}

export interface RiskEntry {
  factor: string;
  likelihood: number;
  likelihoodLabel: string;
  impact: number;
  impactLabel: string;
  score: number;
}

export interface ActionItem {
  number: number;
  action: string;
  owner: string;
  dueDate: string;
  priority: string;
}

export interface DPSIAReport {
  // Section 1: Executive Summary
  ragStatus: RAGStatus;
  recommendation: Recommendation;
  executiveSummary: string;
  keyFindings: string[];
  conditions: string[];

  // Section 2: Vendor Overview
  vendorLegalName: string;
  vendorHeadquarters: string;
  vendorIndustry: string;
  vendorWebsite: string;
  vendorTrustCentre: string;
  servicesUsed: Array<{ service: string; description: string; dataRole: string }>;

  // Section 3: Certification Status
  certifications: CertificationEntry[];
  certificationNotes: string;

  // Section 4: Breach History
  breachHistory: BreachEntry[];
  cveHistory: CVEEntry[];
  enforcementActions: Array<{ authority: string; action: string; status: string }>;

  // Section 5: CIA Triad
  confidentialityControls: CIAControl[];
  confidentialityScore: string;
  integrityControls: CIAControl[];
  integrityScore: string;
  availabilityControls: CIAControl[];
  availabilityScore: string;

  // Section 6: Data Handling
  dataProcessing: Record<string, string>;
  dataStorage: Record<string, string>;
  dataTransmission: Record<string, string>;

  // Section 7: GDPR Compliance
  gdprDpa: Record<string, string>;
  gdprDataSubjectRights: Record<string, string>;
  gdprInternationalTransfers: Record<string, string>;

  // Section 8: Supplier Form Verification
  supplierFormAvailable: boolean;
  supplierFormVerification: string;

  // Section 9: Risk Assessment
  inherentRisks: RiskEntry[];
  inherentRiskScore: number;
  inherentRiskLevel: RiskLevel;
  controlEffectiveness: string;
  controlEffectivenessPercent: number;
  residualRiskScore: number;
  residualRiskLevel: RiskLevel;

  // Section 10: Recommendation
  mandatoryActions: ActionItem[];
  monitoringRequirements: string[];

  // Section 11: Sources
  primarySources: string[];
  incidentReports: string[];
  thirdPartyAnalysis: string[];

  // Section 12: Document Control
  assessmentDate: string;
  assessor: string;
  version: string;
}

export interface AssessmentOutput {
  status: 'complete' | 'error';
  vendorName: string;
  ragStatus: RAGStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  executiveSummary: string;
  reportMarkdown: string;
  reportDocxBase64: string;
  reportFilename: string;
  researchSources: string[];
  processingTimeMs: number;
  error?: string;
}
