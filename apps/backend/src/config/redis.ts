import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err: Error) => {
  console.error('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  console.info('Redis Client Connected');
});

redisClient.on('reconnecting', () => {
  console.warn('Redis Client Reconnecting');
});

redisClient.on('ready', () => {
  console.info('Redis Client Ready');
});

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}

export default redisClient;
