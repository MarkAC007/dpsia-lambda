import { describe, it, expect, vi } from 'vitest';
import { conductResearch, formatResearchForPrompt } from '../../src/research/orchestrator.js';
import { generateQueries } from '../../src/research/queries.js';
import type { AggregatedResults, ResearchResult } from '../../src/research/types.js';

// Mock fetch globally for provider tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('generateQueries', () => {
  it('generates 9 queries (3 per provider)', () => {
    const queries = generateQueries('JumpCloud, Inc.', 'Directory-as-a-Service, MDM');
    expect(queries.perplexity).toHaveLength(3);
    expect(queries.gemini).toHaveLength(3);
    expect(queries.grok).toHaveLength(3);
  });

  it('strips common suffixes from vendor name', () => {
    const queries = generateQueries('Acme Corp.', 'SaaS Platform');
    expect(queries.perplexity[0]).toContain('Acme');
    expect(queries.perplexity[0]).not.toContain('Corp.');
  });

  it('includes services context in relevant queries', () => {
    const queries = generateQueries('TestVendor', 'API Gateway, CDN');
    // Perplexity query 3 and Gemini query 3 should include services
    expect(queries.perplexity[2]).toContain('API Gateway');
    expect(queries.gemini[2]).toContain('API Gateway');
  });
});

describe('conductResearch', () => {
  it('handles all providers failing gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await conductResearch('TestVendor', {
      perplexityApiKey: 'test-key',
      googleApiKey: 'test-key',
      xaiApiKey: 'test-key',
      timeoutMs: 5000,
    });

    expect(result.results).toHaveLength(9);
    expect(result.failureCount).toBe(9);
    expect(result.successCount).toBe(0);
  });

  it('collects results from all 9 queries', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test research content' } }],
        citations: ['https://example.com'],
        candidates: [{ content: { parts: [{ text: 'Gemini content' }] } }],
      }),
    });

    const result = await conductResearch('TestVendor', {
      perplexityApiKey: 'test-key',
      googleApiKey: 'test-key',
      xaiApiKey: 'test-key',
      timeoutMs: 10000,
    });

    expect(result.results).toHaveLength(9);
    expect(result.successCount).toBeGreaterThan(0);
  });
});

describe('formatResearchForPrompt', () => {
  it('formats results grouped by provider', () => {
    const aggregated: AggregatedResults = {
      results: [
        { provider: 'Perplexity', query: 'test query 1', content: 'Found certifications', sources: ['https://example.com'], success: true, durationMs: 1000 },
        { provider: 'Gemini', query: 'test query 2', content: 'Security analysis', sources: [], success: true, durationMs: 2000 },
        { provider: 'Grok', query: 'test query 3', content: 'No incidents found', sources: [], success: true, durationMs: 1500 },
      ],
      totalDurationMs: 2000,
      providersUsed: ['Perplexity', 'Gemini', 'Grok'],
      allSources: ['https://example.com'],
      successCount: 3,
      failureCount: 0,
    };

    const text = formatResearchForPrompt(aggregated);
    expect(text).toContain('### Perplexity (Web Search with Citations)');
    expect(text).toContain('### Gemini (Multi-Perspective Analysis)');
    expect(text).toContain('### Grok (Contrarian Analysis)');
    expect(text).toContain('Found certifications');
    expect(text).toContain('Security analysis');
    expect(text).toContain('No incidents found');
  });

  it('marks failed queries', () => {
    const aggregated: AggregatedResults = {
      results: [
        { provider: 'Perplexity', query: 'test', content: '', sources: [], success: false, error: 'API timeout', durationMs: 5000 },
      ],
      totalDurationMs: 5000,
      providersUsed: [],
      allSources: [],
      successCount: 0,
      failureCount: 1,
    };

    const text = formatResearchForPrompt(aggregated);
    expect(text).toContain('*Failed: API timeout*');
  });
});
