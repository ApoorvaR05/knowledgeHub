export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;
