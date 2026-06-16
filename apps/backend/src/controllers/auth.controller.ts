/**
 * Auth Controller
 * Handles authentication-related HTTP requests
 */
import type { Response } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  AuthResponse,
  TokenRefreshResponse,
  UserResponse,
} from '../types';

// Zod validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const AuthController = {
  /**
   * Register a new user
   */
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const validatedData: RegisterRequest = registerSchema.parse(req.body);

      // Register user
      const result = await AuthService.register(validatedData);

      // Create audit log (non-blocking)
      void AuthService.createAuditLog({
        userId: result.user.id,
        action: 'register',
        resource: 'user',
        resourceId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: true,
      });

      // Send response
      const response: AuthResponse = {
        success: true,
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      if (error instanceof Error) {
        // Create audit log for failed registration (non-blocking)
        void AuthService.createAuditLog({
          action: 'register',
          resource: 'user',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success: false,
          metadata: { error: error.message },
        });

        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  /**
   * Login a user
   */
  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const validatedData: LoginRequest = loginSchema.parse(req.body);

      // Login user
      const result = await AuthService.login(validatedData);

      // Create audit log (non-blocking)
      void AuthService.createAuditLog({
        userId: result.user.id,
        action: 'login',
        resource: 'user',
        resourceId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: true,
      });

      // Send response
      const response: AuthResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      if (error instanceof Error) {
        // Create audit log for failed login (non-blocking)
        void AuthService.createAuditLog({
          action: 'login',
          resource: 'user',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success: false,
          metadata: { error: error.message },
        });

        res.status(401).json({
          success: false,
          error: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  /**
   * Logout a user
   */
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Validate request body with Zod
      const validatedData: RefreshTokenRequest = refreshTokenSchema.parse(req.body);

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Logout user (invalidate refresh token)
      await AuthService.logout(validatedData.refreshToken, req.user.userId);

      // Create audit log (non-blocking)
      void AuthService.createAuditLog({
        userId: req.user.userId,
        action: 'logout',
        resource: 'user',
        resourceId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: true,
      });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      if (error instanceof Error) {
        // Create audit log for failed logout (non-blocking)
        if (req.user) {
          void AuthService.createAuditLog({
            userId: req.user.userId,
            action: 'logout',
            resource: 'user',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            success: false,
            metadata: { error: error.message },
          });
        }

        res.status(500).json({
          success: false,
          error: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  /**
   * Refresh access token
   */
  async refresh(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const validatedData: RefreshTokenRequest = refreshTokenSchema.parse(req.body);

      // Refresh access token
      const result = await AuthService.refreshAccessToken(validatedData.refreshToken);

      // Create audit log (non-blocking)
      void AuthService.createAuditLog({
        userId: result.accessToken ? undefined : undefined, // We don't have userId from refresh
        action: 'refresh',
        resource: 'token',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: true,
      });

      // Send response
      const response: TokenRefreshResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      if (error instanceof Error) {
        // Create audit log for failed refresh (non-blocking)
        void AuthService.createAuditLog({
          action: 'refresh',
          resource: 'token',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success: false,
          metadata: { error: error.message },
        });

        res.status(401).json({
          success: false,
          error: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  /**
   * Get current user
   */
  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Get current user
      const user = await AuthService.getCurrentUser(req.user.userId);

      // Create audit log (non-blocking)
      void AuthService.createAuditLog({
        userId: user.id,
        action: 'me',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: true,
      });

      // Send response
      const response: UserResponse = {
        success: true,
        data: user,
      };
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        // Create audit log for failed me request (non-blocking)
        if (req.user) {
          void AuthService.createAuditLog({
            userId: req.user.userId,
            action: 'me',
            resource: 'user',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            success: false,
            metadata: { error: error.message },
          });
        }

        // Return 404 only for user not found, 500 for other errors
        if (error.message === 'User not found') {
          res.status(404).json({
            success: false,
            error: error.message,
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Internal server error',
          });
        }
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
};
