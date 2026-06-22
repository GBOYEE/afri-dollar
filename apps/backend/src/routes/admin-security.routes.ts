import { Router } from 'express';

import { AdminSecurityController } from '../controllers/admin-security.controller';
import { adminMiddleware } from '../middleware/auth.middleware';

const adminSecurityRouter = Router();

// All routes require admin role
adminSecurityRouter.use(adminMiddleware);

/**
 * GET /api/v1/admin/security/blocked-ips
 */
adminSecurityRouter.get('/blocked-ips', (req, res, next) => {
  AdminSecurityController.getBlockedIPs(req, res).catch(next);
});

/**
 * GET /api/v1/admin/security/flagged-ips
 */
adminSecurityRouter.get('/flagged-ips', (req, res, next) => {
  AdminSecurityController.getFlaggedIPs(req, res).catch(next);
});

/**
 * GET /api/v1/admin/security/failed-attempts
 */
adminSecurityRouter.get('/failed-attempts', (req, res, next) => {
  AdminSecurityController.getFailedAttempts(req, res).catch(next);
});

/**
 * POST /api/v1/admin/security/unblock-ip
 */
adminSecurityRouter.post('/unblock-ip', (req, res, next) => {
  AdminSecurityController.unblockIP(req, res).catch(next);
});

export default adminSecurityRouter;
