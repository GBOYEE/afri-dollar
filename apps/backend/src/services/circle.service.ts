import axios, { AxiosInstance } from 'axios';

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
const CIRCLE_API_URL = process.env.CIRCLE_API_URL || 'https://api-sandbox.circle.com';

export interface CircleWallet {
  walletId: string;
  entityId: string;
  type: string;
  balances: Array<{
    amount: string;
    currency: string;
  }>;
}

export interface DepositAddress {
  address: string;
  addressTag?: string;
  currency: string;
  chain: string;
}

export interface CirclePayout {
  id: string;
  sourceWalletId?: string;
  destination: {
    type: string;
    address: string;
    addressTag?: string;
    chain?: string;
  };
  amount: {
    amount: string;
    currency: string;
  };
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CircleTransaction {
  id: string;
  type: string;
  status: string;
  amount?: {
    amount: string;
    currency: string;
  };
  createdAt: string;
  updatedAt?: string;
}

function createClient(): AxiosInstance {
  if (!CIRCLE_API_KEY) {
    throw new Error('CIRCLE_API_KEY environment variable is not configured.');
  }

  return axios.create({
    baseURL: CIRCLE_API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
    },
    timeout: 30_000,
  });
}

function handleApiError(error: unknown, operation: string): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message =
      (data?.message as string) ||
      (data?.error as string) ||
      error.message ||
      'Unknown error';
    throw new Error(`Circle API ${operation} failed (${status}): ${message}`);
  }
  throw new Error(`Circle API ${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

export const CircleService = {
  /**
   * Create a new Circle wallet.
   */
  async createWallet(description?: string): Promise<CircleWallet> {
    const client = createClient();
    try {
      const entityId = process.env.CIRCLE_ENTITY_ID || 'default';
      const response = await client.post('/v1/wallets', {
        idempotencyKey: crypto.randomUUID(),
        description: description || 'AfriDollar wallet',
      });

      const wallet = response.data.data;
      return {
        walletId: wallet.walletId,
        entityId: wallet.entityId || entityId,
        type: wallet.type || 'end_user',
        balances: wallet.balances || [],
      };
    } catch (error) {
      handleApiError(error, 'createWallet');
    }
  },

  /**
   * Get wallet balance for a specific wallet.
   */
  async getWalletBalance(walletId: string): Promise<CircleWallet['balances']> {
    const client = createClient();
    try {
      const response = await client.get(`/v1/wallets/${walletId}`);
      const wallet = response.data.data;
      return wallet.balances || [];
    } catch (error) {
      handleApiError(error, 'getWalletBalance');
    }
  },

  /**
   * Create a deposit address for a wallet.
   */
  async createDepositAddress(
    walletId: string,
    currency: string = 'USD',
    chain: string = 'ETH'
  ): Promise<DepositAddress> {
    const client = createClient();
    try {
      const response = await client.post(`/v1/wallets/${walletId}/addresses`, {
        idempotencyKey: crypto.randomUUID(),
        currency,
        chain,
      });

      const address = response.data.data;
      return {
        address: address.address,
        addressTag: address.addressTag,
        currency: address.currency || currency,
        chain: address.chain || chain,
      };
    } catch (error) {
      handleApiError(error, 'createDepositAddress');
    }
  },

  /**
   * Initiate a payout from a Circle wallet.
   */
  async initiatePayout(options: {
    sourceWalletId: string;
    destinationAddress: string;
    amount: string;
    currency?: string;
    chain?: string;
    memo?: string;
  }): Promise<CirclePayout> {
    const client = createClient();
    try {
      const response = await client.post('/v1/payouts', {
        idempotencyKey: crypto.randomUUID(),
        source: {
          type: 'wallet',
          id: options.sourceWalletId,
        },
        destination: {
          type: 'blockchain',
          address: options.destinationAddress,
          chain: options.chain || 'ETH',
        },
        amount: {
          amount: options.amount,
          currency: options.currency || 'USD',
        },
      });

      const payout = response.data.data;
      return {
        id: payout.id,
        sourceWalletId: options.sourceWalletId,
        destination: {
          type: 'blockchain',
          address: options.destinationAddress,
          chain: options.chain || 'ETH',
        },
        amount: {
          amount: options.amount,
          currency: options.currency || 'USD',
        },
        status: payout.status,
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt,
      };
    } catch (error) {
      handleApiError(error, 'initiatePayout');
    }
  },

  /**
   * Check the status of a Circle transaction or payout.
   */
  async getTransactionStatus(transactionId: string): Promise<CircleTransaction> {
    const client = createClient();
    try {
      const response = await client.get(`/v1/transfers/${transactionId}`);
      const tx = response.data.data;
      return {
        id: tx.id,
        type: tx.type || 'transfer',
        status: tx.status,
        amount: tx.amount,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    } catch (error) {
      // Try payouts endpoint if transfers fails
      try {
        const response = await client.get(`/v1/payouts/${transactionId}`);
        const payout = response.data.data;
        return {
          id: payout.id,
          type: 'payout',
          status: payout.status,
          amount: payout.amount,
          createdAt: payout.createdAt,
          updatedAt: payout.updatedAt,
        };
      } catch (payoutError) {
        handleApiError(error, 'getTransactionStatus');
      }
    }
  },
};
