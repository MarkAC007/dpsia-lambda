import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface DPSIASecrets {
  ANTHROPIC_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  GOOGLE_API_KEY: string;
  XAI_API_KEY: string;
}

let cached: DPSIASecrets | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch DPSIA secrets from environment variables or AWS Secrets Manager.
 *
 * When SECRETS_BACKEND=env (Azure Container App deployment), reads exclusively
 * from environment variables and never touches AWS Secrets Manager.
 * Otherwise falls back to the original AWS Secrets Manager path (Lambda deployment).
 */
export async function getSecrets(): Promise<DPSIASecrets> {
  // Check cache
  if (cached && Date.now() < cacheExpiry) {
    return cached;
  }

  // Try environment variables first (Azure Container App, local dev)
  const fromEnv = getFromEnv();
  if (fromEnv) {
    cached = fromEnv;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return cached;
  }

  // If SECRETS_BACKEND=env, don't fall through to AWS — fail with a clear message
  if (process.env.SECRETS_BACKEND === 'env') {
    throw new Error(
      'SECRETS_BACKEND=env but required environment variables are missing. ' +
      'Set ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, GOOGLE_API_KEY, and XAI_API_KEY.'
    );
  }

  // Fetch from AWS Secrets Manager (Lambda deployment path)
  const secretName = process.env.SECRETS_NAME ?? 'dpsia-lambda/config';
  const region = process.env.AWS_REGION ?? 'eu-west-1';

  const client = new SecretsManagerClient({ region });
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  const parsed = JSON.parse(response.SecretString) as Record<string, string>;

  cached = {
    ANTHROPIC_API_KEY: requireKey(parsed, 'ANTHROPIC_API_KEY'),
    PERPLEXITY_API_KEY: requireKey(parsed, 'PERPLEXITY_API_KEY'),
    GOOGLE_API_KEY: requireKey(parsed, 'GOOGLE_API_KEY'),
    XAI_API_KEY: requireKey(parsed, 'XAI_API_KEY'),
  };
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return cached;
}

function getFromEnv(): DPSIASecrets | null {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const perplexity = process.env.PERPLEXITY_API_KEY;
  const google = process.env.GOOGLE_API_KEY;
  const xai = process.env.XAI_API_KEY;

  if (anthropic && perplexity && google && xai) {
    return {
      ANTHROPIC_API_KEY: anthropic,
      PERPLEXITY_API_KEY: perplexity,
      GOOGLE_API_KEY: google,
      XAI_API_KEY: xai,
    };
  }
  return null;
}

function requireKey(obj: Record<string, string>, key: string): string {
  const value = obj[key];
  if (!value) {
    throw new Error(`Missing required secret: ${key}`);
  }
  return value;
}
