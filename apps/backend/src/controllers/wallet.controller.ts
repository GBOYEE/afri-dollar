import { Response } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware';
import { WalletService } from '../services/wallet.service';
import { AppError } from '../types';

function handleError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ success: false, error: error.message });
    return;
  }

  if (error instanceof Error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
    return;
  }

  res.status(500).json({ success: false, error: 'An unknown error occurred' });
}

export const WalletController = {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { walletType, network } = req.body as {
        walletType: 'business' | 'treasury' | 'payroll';
        network?: 'testnet' | 'mainnet';
      };

      const resolvedNetwork = network || 'testnet';

      const wallet = await WalletService.createWallet({
        userId: req.user!.userId,
        walletType,
        network: resolvedNetwork,
      });

      res.status(201).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const wallets = await WalletService.getWalletsByUser(req.user!.userId);

      res.status(200).json({
        success: true,
        data: wallets,
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const wallet = await WalletService.getWalletById(id, req.user!.userId);

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getBalances(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const balances = await WalletService.getWalletBalances(id, req.user!.userId);

      res.status(200).json({
        success: true,
        data: balances,
      });
    } catch (error) {
      handleError(res, error);
    }
  },
};
