import path from 'path';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Custom format that redacts sensitive fields from log messages.
 * Scans for common sensitive keys and replaces their values with [REDACTED].
 */
const sensitiveKeys = [
  'password',
  'secret',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'seed',
  'mnemonic',
  'creditCard',
  'credit_card',
  'ssn',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'jwt',
  'encryptionKey',
  'encryption_key',
];

const redactFormat = winston.format((info) => {
  const redactedKeys = sensitiveKeys.join('|');
  const regex = new RegExp(`(["']?(?:${redactedKeys})["']?\\s*[:=]\\s*["']?)([^"'\s,}]+)`, 'gi');

  if (typeof info.message === 'string') {
    info.message = info.message.replace(regex, '$1[REDACTED]');
  }

  // Also check the metadata object for sensitive keys
  if (info.meta && typeof info.meta === 'object') {
    for (const key of Object.keys(info.meta)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        (info.meta as Record<string, unknown>)[key] = '[REDACTED]';
      }
    }
  }

  return info;
});

/**
 * Console format for development: human-readable with colors.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactFormat(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * File format for production: structured JSON.
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  redactFormat(),
  winston.format.json()
);

/**
 * Daily rotate transport for error-level logs.
 */
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
});

/**
 * Daily rotate transport for combined logs (all levels).
 */
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

/**
 * Daily rotate transport for HTTP-level logs.
 */
const httpRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxSize: '20m',
  maxFiles: '7d',
  format: fileFormat,
});

const transports: winston.transport[] = [];

// Always add console transport
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
  })
);

// Add file transports in production or when explicitly enabled
if (NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGS === 'true') {
  transports.push(errorRotateTransport, combinedRotateTransport, httpRotateTransport);
}

/**
 * Winston logger instance with the following log levels:
 * - error: 0
 * - warn: 1
 * - info: 2
 * - http: 3
 * - debug: 4
 *
 * Features:
 * - Console transport for development (colored, human-readable)
 * - Daily rotating file transports for production (structured JSON)
 * - Sensitive data redaction (passwords, tokens, keys, etc.)
 * - Configurable log level via LOG_LEVEL env var
 * - Configurable log directory via LOG_DIR env var
 */
const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  transports,
  // Don't exit on unhandled errors — let the process handle them
  exitOnError: false,
});

export default logger;
