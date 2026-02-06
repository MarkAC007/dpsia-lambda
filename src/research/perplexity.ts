import type { ResearchProvider, ResearchResult } from './types.js';

/**
 * Perplexity Sonar API client.
 * Best for factual queries with web search citations.
 */
export class PerplexityProvider implements ResearchProvider {
  readonly name = 'Perplexity';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, timeoutMs = 60_000): Promise<ResearchResult> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: query }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          provider: this.name,
          query,
          content: '',
          sources: [],
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          durationMs: Date.now() - start,
        };
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: string[];
      };

      const content = data.choices?.[0]?.message?.content ?? '';
      const sources = data.citations ?? [];

      return {
        provider: this.name,
        query,
        content,
        sources,
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        provider: this.name,
        query,
        content: '',
        sources: [],
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }
}
