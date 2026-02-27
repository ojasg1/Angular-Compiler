import express from 'express';
import cors from 'cors';
import { rateLimit, setRedisClient } from './middleware/rate-limit.js';
import { createSessionRoutes } from './routes/session.routes.js';
import { createSubmitRoutes } from './routes/submit.routes.js';
import { createLlmRoutes } from './routes/llm.routes.js';
import reportRoutes from './routes/reports.routes.js';
import { createSessionStore } from './services/store-factory.js';
import { initDatabase } from './services/database.service.js';

// Load .env from server directory
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

async function main() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3001', 10);

  // Initialize session store (Redis with memory fallback)
  const store = await createSessionStore();

  // Initialize SQLite database (async — sql.js requires WASM init)
  try {
    await initDatabase();
  } catch (err) {
    console.warn('[DB] Database initialization failed:', (err as Error).message);
  }

  // If Redis store, share client with rate limiter
  if (store.getStoreType() === 'redis') {
    try {
      const { RedisSessionStore } = await import('./services/redis-store.js');
      if (store instanceof RedisSessionStore) {
        setRedisClient(store.getRedisClient());
      }
    } catch {
      // Redis rate limiting not available
    }
  }

  // Middleware
  app.use(cors({
    origin: ['http://localhost:4200', 'http://localhost:4201'],
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' })); // Code snapshots can be large
  app.use(rateLimit);

  // Routes (pass store to route factories)
  app.use('/api/session', createSessionRoutes(store));
  app.use('/api/submit', createSubmitRoutes(store));
  app.use('/api/llm', createLlmRoutes(store));
  app.use('/api/reports', reportRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      storeType: store.getStoreType(),
    });
  });

  // Start
  app.listen(PORT, () => {
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || '').trim();
    console.log(`\n  Assessment server running on http://localhost:${PORT}`);
    console.log(`  Session store: ${store.getStoreType()}`);
    console.log(`  Anthropic API key: ${hasApiKey ? 'configured' : 'not set'}`);
    console.log(`  Endpoints:`);
    console.log(`    POST /api/session/start`);
    console.log(`    POST /api/session/heartbeat`);
    console.log(`    POST /api/session/event`);
    console.log(`    POST /api/session/challenge`);
    console.log(`    POST /api/submit`);
    console.log(`    POST /api/llm/evaluate`);
    console.log(`    POST /api/llm/hint`);
    console.log(`    GET  /api/session/:id/result`);
    console.log(`    GET  /api/reports/candidate/:sessionId`);
    console.log(`    GET  /api/reports/candidate/:sessionId/pdf`);
    console.log(`    GET  /api/reports/leaderboard/:problemId`);
    console.log(`    GET  /api/reports/analytics/:problemId`);
    console.log(`    GET  /api/reports/analytics/:problemId/tests`);
    console.log(`    GET  /api/reports/analytics/:problemId/trends`);
    console.log(`    GET  /api/reports/export/:problemId/csv`);
    console.log(`    GET  /api/reports/export/:problemId/json`);
    console.log(`    GET  /api/reports/anti-cheat/:sessionId`);
    console.log(`    GET  /api/health\n`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
