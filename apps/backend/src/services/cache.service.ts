import redisClient, { connectRedis } from '../config/redis';

export const CACHE_KEYS = {
  FX_RATES: 'fx:rates',
  walletBalance: (walletId: string) => `wallet:balance:${walletId}`,
  stellarAccount: (publicKey: string) => `stellar:account:${publicKey}`,
} as const;

export const CACHE_TTL = {
  FX_RATES: 300, // 5 minutes
  WALLET_BALANCE: 30, // 30 seconds
  STELLAR_ACCOUNT: 60, // 1 minute
} as const;

export const CacheService = {
  async get<T>(key: string): Promise<T | null> {
    await connectRedis();
    const value = await redisClient.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await connectRedis();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  },

  async del(key: string): Promise<void> {
    await connectRedis();
    await redisClient.del(key);
  },

  async delPattern(pattern: string): Promise<void> {
    await connectRedis();
    let cursor = 0;
    do {
      const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length > 0) {
        await redisClient.del(result.keys);
      }
    } while (cursor !== 0);
  },

  async getWalletBalance(walletId: string): Promise<string | null> {
    return this.get<string>(CACHE_KEYS.walletBalance(walletId));
  },

  async setWalletBalance(walletId: string, balance: string): Promise<void> {
    return this.set(CACHE_KEYS.walletBalance(walletId), balance, CACHE_TTL.WALLET_BALANCE);
  },

  async getStellarAccount(publicKey: string): Promise<unknown | null> {
    return this.get(CACHE_KEYS.stellarAccount(publicKey));
  },

  async setStellarAccount(publicKey: string, accountData: unknown): Promise<void> {
    return this.set(CACHE_KEYS.stellarAccount(publicKey), accountData, CACHE_TTL.STELLAR_ACCOUNT);
  },

  async getFxRates(): Promise<unknown | null> {
    return this.get(CACHE_KEYS.FX_RATES);
  },

  async setFxRates(rates: unknown): Promise<void> {
    return this.set(CACHE_KEYS.FX_RATES, rates, CACHE_TTL.FX_RATES);
  },

  async invalidateWalletBalance(walletId: string): Promise<void> {
    return this.del(CACHE_KEYS.walletBalance(walletId));
  },

  async invalidateStellarAccount(publicKey: string): Promise<void> {
    return this.del(CACHE_KEYS.stellarAccount(publicKey));
  },

  async invalidateFxRates(): Promise<void> {
    return this.del(CACHE_KEYS.FX_RATES);
  },
};
