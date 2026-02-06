import type { ResearchProvider, ResearchResult } from './types.js';

/**
 * Gemini 2.0 Flash API client.
 * Best for multi-perspective analysis and comprehensive research.
 */
export class GeminiProvider implements ResearchProvider {
  readonly name = 'Gemini';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, timeoutMs = 60_000): Promise<ResearchResult> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Research the following topic and provide comprehensive findings. Include specific details, dates, and verifiable facts:\n\n${query}`,
            }],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
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
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

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
