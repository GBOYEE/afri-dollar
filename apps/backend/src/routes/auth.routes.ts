import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  bruteForceProtection,
  flaggedIPRateLimit,
} from '../middleware/brute-force.middleware';
import { validate } from '../middleware/validation.middleware';
import { loginSchema, registerSchema, refreshTokenSchema } from '../utils/validation';

/**
 * Auth Routes
 * Defines authentication-related API endpoints
 */
const authRouter = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
authRouter.post('/register', validate(registerSchema), (req, res, next) => {
  AuthController.register(req, res).catch(next);
});

/**
 * POST /api/v1/auth/login
 * Login a user — protected by brute-force detection and flagged IP rate limiting
 */
authRouter.post(
  '/login',
  bruteForceProtection,
  flaggedIPRateLimit,
  validate(loginSchema),
  (req, res, next) => {
    AuthController.login(req, res).catch(next);
  }
);

/**
 * POST /api/v1/auth/logout
 * Logout a user (requires valid JWT)
 */
authRouter.post('/logout', authMiddleware, validate(refreshTokenSchema), (req, res, next) => {
  AuthController.logout(req, res).catch(next);
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
authRouter.post('/refresh', bruteForceProtection, validate(refreshTokenSchema), (req, res, next) => {
  AuthController.refresh(req, res).catch(next);
});

/**
 * GET /api/v1/auth/me
 * Get current user information (requires valid JWT)
 */
authRouter.get('/me', authMiddleware, (req, res, next) => {
  AuthController.me(req, res).catch(next);
});

export default authRouter;
