import type { AggregatedResults, ResearchProvider, ResearchResult } from './types.js';
import { PerplexityProvider } from './perplexity.js';
import { GeminiProvider } from './gemini.js';
import { GrokProvider } from './grok.js';
import { generateQueries } from './queries.js';

export interface ResearchConfig {
  perplexityApiKey: string;
  googleApiKey: string;
  xaiApiKey: string;
  timeoutMs?: number;
}

/**
 * Parallel multi-provider research coordinator.
 * Fires 9 queries (3 per provider) via Promise.allSettled() and collects results.
 */
export async function conductResearch(
  vendorName: string,
  config: ResearchConfig,
  servicesUsed?: string,
): Promise<AggregatedResults> {
  const start = Date.now();
  const timeoutMs = config.timeoutMs ?? 90_000;

  const queries = generateQueries(vendorName, servicesUsed);

  const providers: Array<{ provider: ResearchProvider; queries: string[] }> = [
    { provider: new PerplexityProvider(config.perplexityApiKey), queries: queries.perplexity },
    { provider: new GeminiProvider(config.googleApiKey), queries: queries.gemini },
    { provider: new GrokProvider(config.xaiApiKey), queries: queries.grok },
  ];

  // Build all 9 search tasks
  const tasks: Array<{ provider: ResearchProvider; query: string }> = [];
  for (const { provider, queries: providerQueries } of providers) {
    for (const query of providerQueries) {
      tasks.push({ provider, query });
    }
  }

  // Fire all 9 queries in parallel
  const settled = await Promise.allSettled(
    tasks.map(({ provider, query }) => provider.search(query, timeoutMs))
  );

  // Collect results
  const results: ResearchResult[] = settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    return {
      provider: tasks[i].provider.name,
      query: tasks[i].query,
      content: '',
      sources: [],
      success: false,
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      durationMs: Date.now() - start,
    };
  });

  // Aggregate
  const allSources: string[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    for (const src of r.sources) {
      const normalised = src.trim().toLowerCase();
      if (!seen.has(normalised)) {
        seen.add(normalised);
        allSources.push(src);
      }
    }
  }

  const providersUsed = [...new Set(results.filter(r => r.success).map(r => r.provider))];

  return {
    results,
    totalDurationMs: Date.now() - start,
    providersUsed,
    allSources,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
  };
}

/**
 * Format research results into a text block for the Claude synthesis prompt.
 */
export function formatResearchForPrompt(aggregated: AggregatedResults): string {
  const sections: string[] = [];

  const byProvider = new Map<string, ResearchResult[]>();
  for (const r of aggregated.results) {
    const existing = byProvider.get(r.provider) ?? [];
    existing.push(r);
    byProvider.set(r.provider, existing);
  }

  for (const [provider, results] of byProvider) {
    const label = provider === 'Perplexity' ? 'Perplexity (Web Search with Citations)'
      : provider === 'Gemini' ? 'Gemini (Multi-Perspective Analysis)'
      : provider === 'Grok' ? 'Grok (Contrarian Analysis)'
      : provider;

    sections.push(`### ${label}\n`);

    for (const r of results) {
      if (r.success && r.content) {
        sections.push(`**Query:** ${r.query}\n`);
        sections.push(r.content);
        if (r.sources.length > 0) {
          sections.push('\n**Sources:**');
          for (const src of r.sources) {
            sections.push(`- ${src}`);
          }
        }
        sections.push('');
      } else if (!r.success) {
        sections.push(`**Query:** ${r.query}`);
        sections.push(`*Failed: ${r.error}*\n`);
      }
    }
  }

  return sections.join('\n');
}
