import type { Response } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware';
import {
  getBlockedIPs,
  getFlaggedIPs,
  getFailedAttempts,
  unblockIP,
} from '../middleware/brute-force.middleware';

export const AdminSecurityController = {
  /**
   * GET /api/v1/admin/security/blocked-ips
   * List all blocked IPs (admin only)
   */
  async getBlockedIPs(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const blocked = getBlockedIPs();
      res.status(200).json({
        success: true,
        data: blocked,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch blocked IPs' });
    }
  },

  /**
   * GET /api/v1/admin/security/flagged-ips
   * List all flagged IPs (admin only)
   */
  async getFlaggedIPs(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const flagged = getFlaggedIPs();
      res.status(200).json({
        success: true,
        data: flagged,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch flagged IPs' });
    }
  },

  /**
   * GET /api/v1/admin/security/failed-attempts
   * List recent failed login attempts (admin only)
   */
  async getFailedAttempts(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const attempts = getFailedAttempts();
      res.status(200).json({
        success: true,
        data: attempts,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch failed attempts' });
    }
  },

  /**
   * POST /api/v1/admin/security/unblock-ip
   * Unblock a specific IP (admin only)
   */
  async unblockIP(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ip } = req.body as { ip: string };
      if (!ip) {
        res.status(400).json({ success: false, error: 'IP address is required' });
        return;
      }

      const wasUnblocked = unblockIP(ip);
      if (wasUnblocked) {
        res.status(200).json({
          success: true,
          message: `IP ${ip} has been unblocked`,
        });
      } else {
        res.status(404).json({
          success: false,
          error: `IP ${ip} was not found in blocked or flagged lists`,
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to unblock IP' });
    }
  },
};
