import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { prisma } from '@brightloop/database';

const server = app.listen(env.PORT, () => {
  logger.info(`Brightloop API server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Prisma disconnected. Process exiting.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
