import type { ResearchProvider, ResearchResult } from './types.js';

/**
 * xAI Grok API client.
 * Best for contrarian, unbiased fact-checking and incident analysis.
 */
export class GrokProvider implements ResearchProvider {
  readonly name = 'Grok';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, timeoutMs = 60_000): Promise<ResearchResult> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [{
            role: 'system',
            content: 'You are a contrarian, fact-based security researcher. Focus on finding verifiable incidents, enforcement actions, and security concerns. Be thorough and unbiased. Cite specific dates and sources where possible.',
          }, {
            role: 'user',
            content: query,
          }],
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
      };

      const content = data.choices?.[0]?.message?.content ?? '';

      return {
        provider: this.name,
        query,
        content,
        sources: [],
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
