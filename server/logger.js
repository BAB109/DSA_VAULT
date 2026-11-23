/**
 * Structured logger for DSA Vault backend.
 * Outputs formatted JSON logs in production, and clean readable logs in development.
 */

const isProduction = process.env.NODE_ENV === 'production';

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  if (isProduction) {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  }
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : level === 'http' ? '🌐' : '🟢';
  return `${prefix} [${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`;
}

export const logger = {
  info(message, meta) {
    console.log(formatLog('info', message, meta));
  },
  warn(message, meta) {
    console.warn(formatLog('warn', message, meta));
  },
  error(message, meta) {
    console.error(formatLog('error', message, meta));
  },
  http(message, meta) {
    console.log(formatLog('http', message, meta));
  },
};

/**
 * Express middleware for structured HTTP request/response logging
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Hook response finish
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    // Don't clutter logs with high-frequency health checks in development
    if (!isProduction && req.path === '/api/health') return;

    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} (${durationMs}ms)`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 100) : undefined,
    });
  });

  next;
  next();
}

export default logger;
