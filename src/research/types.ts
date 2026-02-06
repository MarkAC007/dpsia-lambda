export interface ResearchResult {
  provider: string;
  query: string;
  content: string;
  sources: string[];
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface AggregatedResults {
  results: ResearchResult[];
  totalDurationMs: number;
  providersUsed: string[];
  allSources: string[];
  successCount: number;
  failureCount: number;
}

export interface ResearchProvider {
  name: string;
  search(query: string, timeoutMs?: number): Promise<ResearchResult>;
}
