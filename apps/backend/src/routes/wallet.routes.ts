import { Router } from 'express';

import { WalletController } from '../controllers/wallet.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createWalletSchema, walletIdParamSchema } from '../utils/validation';

const walletRouter = Router();

walletRouter.post('/create', authMiddleware, validate(createWalletSchema), (req, res, next) => {
  WalletController.create(req, res).catch(next);
});

walletRouter.get('/', authMiddleware, (req, res, next) => {
  WalletController.list(req, res).catch(next);
});

walletRouter.get('/:id', authMiddleware, validate(walletIdParamSchema), (req, res, next) => {
  WalletController.getById(req, res).catch(next);
});

walletRouter.get('/:id/balances', authMiddleware, validate(walletIdParamSchema), (req, res, next) => {
  WalletController.getBalances(req, res).catch(next);
});

export default walletRouter;
