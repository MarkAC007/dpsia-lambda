/**
 * HTTP server wrapper for the DPSIA assessment service.
 *
 * Exposes the same assessment logic as the Lambda handler via a simple
 * HTTP endpoint, suitable for deployment as an Azure Container App.
 *
 * POST /assess  — run a DPSIA vendor assessment
 * GET  /health  — health check
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './handler.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function start() {
  // Use Node's built-in http module to avoid adding a dependency
  const { createServer } = await import('node:http');

  const server = createServer(async (req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Assessment endpoint
    if (req.method === 'POST' && req.url === '/assess') {
      try {
        // Read request body
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = Buffer.concat(chunks).toString('utf-8');

        // Wrap in API Gateway event format for the existing handler
        const event: APIGatewayProxyEvent = {
          body,
          httpMethod: 'POST',
          path: '/assess',
          headers: { 'Content-Type': 'application/json' },
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as APIGatewayProxyEvent['requestContext'],
          resource: '',
        };

        const result = await handler(event);

        res.writeHead(result.statusCode, {
          'Content-Type': 'application/json',
          ...result.headers,
        });
        res.end(result.body);
      } catch (err) {
        console.error('[DPSIA Server] Unhandled error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
      return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.requestTimeout = 900_000;  // 15 minutes
  server.headersTimeout = 910_000;

  server.listen(PORT, () => {
    console.log(`[DPSIA Server] Listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[DPSIA Server] Failed to start:', err);
  process.exit(1);
});
