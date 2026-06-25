export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiration: number;
  jwtRefreshExpiration: number;
  frontendUrl: string;
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://impressora:impressora123@localhost:5432/impressora',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    jwtExpiration: parseInt(process.env.JWT_EXPIRATION || '900', 10),
    jwtRefreshExpiration: parseInt(process.env.JWT_REFRESH_EXPIRATION || '2592000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  };
}
