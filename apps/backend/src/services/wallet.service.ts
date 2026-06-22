import { Keypair } from '@stellar/stellar-sdk';

import prisma from '../config/database';
import { AppError } from '../types';
import type { CreateWalletOptions, WalletWithKeys } from '../types';
import { encrypt } from '../utils/crypto';

import { StellarService } from './stellar.service';

export const WalletService = {
  async createWallet(options: CreateWalletOptions): Promise<WalletWithKeys> {
    const user = await prisma.user.findUnique({
      where: { id: options.userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    const secretKeyEncrypted = encrypt(secretKey);

    if (options.network === 'testnet') {
      await StellarService.fundTestnetAccount(publicKey);
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId: options.userId,
        publicKey,
        secretKeyEncrypted,
        walletType: options.walletType,
        network: options.network,
      },
    });

    return {
      id: wallet.id,
      publicKey: wallet.publicKey,
      secretKey,
    };
  },

  async getWalletsByUser(userId: string): Promise<WalletWithKeys[]> {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return wallets.map((w) => ({
      id: w.id,
      publicKey: w.publicKey,
    }));
  },

  async getWalletById(walletId: string, userId: string): Promise<WalletWithKeys> {
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    return {
      id: wallet.id,
      publicKey: wallet.publicKey,
    };
  },

  async getWalletBalances(walletId: string, userId: string) {
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    const balances = await StellarService.getAccountBalances(wallet.publicKey);

    return {
      walletId: wallet.id,
      publicKey: wallet.publicKey,
      network: wallet.network,
      balances,
    };
  },
};
