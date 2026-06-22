import type { Request, Response, NextFunction } from 'express';

import type { AuthRequest } from './auth.middleware';

interface FailedAttemptRecord {
  ip: string;
  userId?: string;
  attempts: number;
  lastAttemptAt: Date;
  lockedUntil?: Date;
}

interface BlockedIPRecord {
  ip: string;
  blockedAt: Date;
  reason: string;
  attemptCount: number;
}

// In-memory store for failed attempts and blocked IPs
// In production, use Redis for distributed tracking
const failedAttempts = new Map<string, FailedAttemptRecord>();
const blockedIPs = new Map<string, BlockedIPRecord>();
const flaggedIPs = new Set<string>();

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15_000; // 15 seconds
const MAX_LOCKOUT_MS = 900_000; // 15 minutes
const ATTEMPT_WINDOW_MS = 900_000; // 15 minutes
const PROGRESSIVE_MULTIPLIER = 2;

/**
 * Calculate progressive lockout duration based on attempt count.
 */
function calculateLockoutMs(attempts: number): number {
  const lockout = BASE_LOCKOUT_MS * Math.pow(PROGRESSIVE_MULTIPLIER, attempts - MAX_ATTEMPTS);
  return Math.min(lockout, MAX_LOCKOUT_MS);
}

/**
 * Clean up expired entries periodically.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [ip, record] of failedAttempts.entries()) {
    if (record.lockedUntil && record.lockedUntil.getTime() < now) {
      failedAttempts.delete(ip);
    } else if (
      !record.lockedUntil &&
      now - record.lastAttemptAt.getTime() > ATTEMPT_WINDOW_MS
    ) {
      failedAttempts.delete(ip);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 300_000);

/**
 * Check if an IP is flagged as risky by a third-party reputation service.
 * This is a placeholder for integration with services like AbuseIPDB, IPQualityScore, etc.
 */
export async function checkIPReputation(ip: string): Promise<{ flagged: boolean; reason?: string }> {
  // Placeholder: integrate with third-party IP reputation service
  // Example: const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`);
  if (flaggedIPs.has(ip)) {
    return { flagged: true, reason: 'Previously flagged for suspicious activity' };
  }
  return { flagged: false };
}

/**
 * Brute-force protection middleware.
 * Tracks failed login attempts and enforces progressive delays.
 */
export function bruteForceProtection(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = new Date();

  const record = failedAttempts.get(ip);

  // Check if IP is currently locked out
  if (record?.lockedUntil && record.lockedUntil > now) {
    const remainingMs = record.lockedUntil.getTime() - now.getTime();
    const remainingSec = Math.ceil(remainingMs / 1000);
    res.status(429).json({
      success: false,
      error: `Too many failed attempts. Please try again in ${remainingSec} seconds.`,
      retryAfter: remainingSec,
    });
    return;
  }

  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    res.status(403).json({
      success: false,
      error: 'Your IP has been blocked due to suspicious activity.',
    });
    return;
  }

  next();
}

/**
 * Record a failed login attempt and apply progressive lockout.
 */
export function recordFailedAttempt(ip: string, userId?: string): void {
  const now = new Date();
  const existing = failedAttempts.get(ip);

  if (!existing) {
    failedAttempts.set(ip, {
      ip,
      userId,
      attempts: 1,
      lastAttemptAt: now,
    });
    return;
  }

  // Reset if outside the attempt window
  if (now.getTime() - existing.lastAttemptAt.getTime() > ATTEMPT_WINDOW_MS) {
    existing.attempts = 1;
    existing.lastAttemptAt = now;
    existing.lockedUntil = undefined;
    return;
  }

  existing.attempts += 1;
  existing.lastAttemptAt = now;
  if (userId) existing.userId = userId;

  // Apply progressive lockout if over threshold
  if (existing.attempts >= MAX_ATTEMPTS) {
    const lockoutMs = calculateLockoutMs(existing.attempts);
    existing.lockedUntil = new Date(now.getTime() + lockoutMs);

    // Flag IP after repeated lockouts
    if (existing.attempts >= MAX_ATTEMPTS + 3) {
      flaggedIPs.add(ip);
    }

    // Block IP after excessive attempts
    if (existing.attempts >= MAX_ATTEMPTS + 10) {
      blockedIPs.set(ip, {
        ip,
        blockedAt: now,
        reason: 'Excessive failed login attempts',
        attemptCount: existing.attempts,
      });
    }
  }
}

/**
 * Clear failed attempts on successful login.
 */
export function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

/**
 * Admin endpoint: get blocked IPs list.
 */
export function getBlockedIPs(): BlockedIPRecord[] {
  return Array.from(blockedIPs.values());
}

/**
 * Admin endpoint: get flagged IPs list.
 */
export function getFlaggedIPs(): string[] {
  return Array.from(flaggedIPs);
}

/**
 * Admin endpoint: get failed attempts (for dashboard metrics).
 */
export function getFailedAttempts(): FailedAttemptRecord[] {
  return Array.from(failedAttempts.values());
}

/**
 * Admin endpoint: unblock an IP.
 */
export function unblockIP(ip: string): boolean {
  const removed1 = blockedIPs.delete(ip);
  const removed2 = flaggedIPs.delete(ip);
  failedAttempts.delete(ip);
  return removed1 || removed2;
}

/**
 * Middleware to apply stricter rate limits for flagged IPs.
 * Should be used on auth routes.
 */
export function flaggedIPRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (flaggedIPs.has(ip)) {
    // Flagged IPs get a small delay to slow down automated attacks
    setTimeout(() => {
      next();
    }, 1000);
    return;
  }

  next();
}
