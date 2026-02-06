/**
 * DPSIA-specific query generator.
 * Generates 9 targeted research queries (3 per provider) for a given vendor.
 */

export interface DPSIAQueries {
  perplexity: [string, string, string];
  gemini: [string, string, string];
  grok: [string, string, string];
}

export function generateQueries(vendorName: string, servicesUsed?: string): DPSIAQueries {
  const shortName = vendorName.replace(/,?\s*(Inc\.|LLC|Ltd\.?|Corp\.?|GmbH|B\.V\.)$/i, '').trim();
  const serviceContext = servicesUsed ? ` ${servicesUsed}` : '';

  return {
    // Perplexity: factual queries with citations
    perplexity: [
      `${shortName} security certifications ISO 27001 SOC 2 Type II 2025 2026`,
      `${shortName} data breach incidents security vulnerabilities CVE history`,
      `${shortName} GDPR compliance data processing agreement privacy policy${serviceContext}`,
    ],

    // Gemini: analytical, comprehensive queries
    gemini: [
      `${shortName} security posture assessment encryption access controls infrastructure. Analyse their security architecture, encryption standards, and access control mechanisms.`,
      `${shortName} vendor risk compliance status regulatory actions enforcement. Evaluate their compliance posture across ISO 27001, SOC 2, GDPR, and any regulatory enforcement actions.`,
      `${shortName} service availability SLA disaster recovery redundancy architecture${serviceContext}. Assess their availability guarantees, redundancy, and disaster recovery capabilities.`,
    ],

    // Grok: contrarian, fact-based queries
    grok: [
      `${shortName} security incidents criticism concerns vulnerabilities 2024 2025 2026. What are the most significant security concerns, incidents, or criticisms? Be thorough and unbiased.`,
      `${shortName} enforcement actions fines regulatory investigations GDPR ICO FTC. Has this company faced any regulatory enforcement, fines, or investigations?`,
      `${shortName} alternatives comparison security weaknesses limitations${serviceContext}. What are the known security weaknesses or limitations compared to alternatives?`,
    ],
  };
}
