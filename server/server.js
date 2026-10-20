import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from './config/env.js';
import { logger, requestLogger } from './logger.js';
import { pool } from '../db/pool.js';
import authRoutes from './routes/auth.js';
import problemsRoutes from './routes/problems.js';
import csFundamentalsRoutes from './routes/csFundamentals.js';
import csAssessmentsRoutes from './routes/csAssessments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

// Validate environment before startup
const config = validateEnv();

const app = express();
const PORT = config.port;

// Trust reverse proxy (e.g. Render, Railway, AWS ALB, Cloudflare, NGINX)
app.set('trust proxy', 1);

// CORS Configuration
const allowedOrigins = config.clientUrl
  ? config.clientUrl.split(',').map((o) => o.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// ── Liveness Health Check Endpoint ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// ── Readiness Endpoint (Checks Database Connectivity) ─────────────────────────
app.get('/api/ready', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (config.isProduction && process.env.REQUIRE_DB === 'true') {
      logger.error('Readiness probe failed: Database unreachable', { error: err.message });
      return res.status(503).json({
        status: 'not_ready',
        database: 'unreachable',
        error: 'Database connection failed.',
        timestamp: new Date().toISOString(),
      });
    }

    // In dev / unconfigured mode: return ready with fallback notice
    return res.status(200).json({
      status: 'ready',
      database: 'in-memory-fallback',
      warning: 'PostgreSQL unreachable; running in development in-memory mode',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Mount API Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api', problemsRoutes);
app.use('/api/cs-fundamentals', csFundamentalsRoutes);
app.use('/api/cs-assessments', csAssessmentsRoutes);

// ── Serve Frontend in Single-Tier Deployment ──────────────────────────────────
if (fs.existsSync(distPath)) {
  logger.info(`Serving static frontend build from ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback for frontend client-side routes (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Centralized Error Handling Middleware ────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', {
    error: err.message,
    stack: config.isProduction ? undefined : err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    error: 'SERVER_ERROR',
    message: 'Internal server error.',
  });
});

export default app;

// ── Server Startup & Graceful Shutdown ────────────────────────────────────────
let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`📡 DSA Vault Backend Server running on port ${PORT}`, {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      cors: allowedOrigins === true ? 'all' : allowedOrigins,
    });
  });

  // Graceful shutdown handling
  let isShuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new incoming requests
    server.close(async () => {
      logger.info('HTTP server closed successfully.');
      try {
        await pool.end();
        logger.info('PostgreSQL connection pool closed.');
      } catch (err) {
        logger.error('Error closing database pool during shutdown', { error: err.message });
      }
      process.exit(0);
    });

    // Enforce hard timeout for graceful shutdown (10 seconds)
    setTimeout(() => {
      logger.error('Graceful shutdown timed out (10s). Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
