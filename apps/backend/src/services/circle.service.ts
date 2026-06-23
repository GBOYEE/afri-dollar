import axios, { AxiosInstance, AxiosError } from 'axios';

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
    chain: string;
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

class CircleAPIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'CircleAPIError';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const code = data?.code;
    const message = data?.message;
    if (code !== undefined && message) {
      return `Circle API error (${code}): ${message}`;
    }
    if (message) {
      return `Circle API error: ${message}`;
    }
    return `Circle API request failed with status ${error.response?.status ?? 'unknown'}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown Circle API error';
}

function createClient(): AxiosInstance {
  if (!CIRCLE_API_KEY) {
    throw new CircleAPIError(500, 'CIRCLE_API_KEY is not configured');
  }

  return axios.create({
    baseURL: CIRCLE_API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
    },
    timeout: 30000,
  });
}

export const CircleService = {
  async createWallet(description?: string): Promise<CircleWallet> {
    const client = createClient();

    try {
      const response = await client.post('/v1/wallets', {
        description: description || 'AfriDollar wallet',
      });

      const wallet = response.data.data as {
        walletId: string;
        entityId: string;
        type: string;
        description?: string;
      };

      return {
        walletId: wallet.walletId,
        entityId: wallet.entityId,
        type: wallet.type,
        balances: [],
      };
    } catch (error) {
      throw new CircleAPIError(
        error instanceof AxiosError ? (error.response?.status ?? 500) : 500,
        getErrorMessage(error)
      );
    }
  },

  async getWalletBalance(walletId: string): Promise<CircleWallet['balances']> {
    const client = createClient();

    try {
      const response = await client.get(`/v1/wallets/${walletId}/balances`);
      const balances = response.data.data as Array<{
        amount: string;
        currency: string;
      }>;

      return balances;
    } catch (error) {
      throw new CircleAPIError(
        error instanceof AxiosError ? (error.response?.status ?? 500) : 500,
        getErrorMessage(error)
      );
    }
  },

  async createDepositAddress(
    walletId: string,
    currency = 'USD',
    chain = 'ETH'
  ): Promise<DepositAddress> {
    const client = createClient();

    try {
      const response = await client.post(`/v1/wallets/${walletId}/addresses`, {
        currency,
        chain,
      });

      const address = response.data.data as {
        address: string;
        addressTag?: string;
        currency: string;
        chain: string;
      };

      return {
        address: address.address,
        addressTag: address.addressTag,
        currency: address.currency,
        chain: address.chain,
      };
    } catch (error) {
      throw new CircleAPIError(
        error instanceof AxiosError ? (error.response?.status ?? 500) : 500,
        getErrorMessage(error)
      );
    }
  },

  async initiatePayout(options: {
    sourceWalletId: string;
    destinationAddress: string;
    amount: string;
    currency?: string;
    chain?: string;
    destinationTag?: string;
    idempotencyKey?: string;
  }): Promise<CirclePayout> {
    const client = createClient();

    try {
      const response = await client.post('/v1/payouts', {
        source: {
          type: 'wallet',
          id: options.sourceWalletId,
        },
        destination: {
          type: 'blockchain',
          address: options.destinationAddress,
          addressTag: options.destinationTag,
          chain: options.chain || 'ETH',
        },
        amount: {
          amount: options.amount,
          currency: options.currency || 'USD',
        },
        idempotencyKey: options.idempotencyKey,
      });

      const payout = response.data.data as CirclePayout;
      return payout;
    } catch (error) {
      throw new CircleAPIError(
        error instanceof AxiosError ? (error.response?.status ?? 500) : 500,
        getErrorMessage(error)
      );
    }
  },

  async getTransactionStatus(transactionId: string): Promise<CircleTransaction> {
    const client = createClient();

    try {
      const response = await client.get(`/v1/transfers/${transactionId}`);
      const transaction = response.data.data as CircleTransaction;
      return transaction;
    } catch (error) {
      throw new CircleAPIError(
        error instanceof AxiosError ? (error.response?.status ?? 500) : 500,
        getErrorMessage(error)
      );
    }
  },

  async getPayoutStatus(payoutId: string): Promise<CirclePayout> {
    const client = createClient();

    try {
      const response = await client.get(`/v1/payouts/${payoutId}`);
      const payout = response.data.data as CirclePayout;
      return payout;
    } catch (error) {
      throw new CircleAPIError(
        error instanceof AxiosError ? (error.response?.status ?? 500) : 500,
        getErrorMessage(error)
      );
    }
  },
};
