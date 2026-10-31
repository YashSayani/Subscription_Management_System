import 'dotenv/config';
import { prisma } from '@brightloop/database';
import { logger } from './common/logger.js';
import { BillingEngine } from './modules/billing/engine.js';

const POLL_INTERVAL_MS = parseInt(process.env.BILLING_POLL_INTERVAL_MS || '15000', 10);
let isRunning = true;
let isProcessing = false;

async function runWorkerLoop() {
  logger.info(
    `[BillingWorker] Worker process started. Polling interval: ${POLL_INTERVAL_MS}ms`,
  );

  while (isRunning) {
    if (!isProcessing) {
      try {
        isProcessing = true;
        const result = await BillingEngine.runBillingCycle(50);
        if (result.processed > 0) {
          logger.info(
            `[BillingWorker] Cycle finished. Processed: ${result.processed}, Generated: ${result.successful}, Errors: ${result.failed}`,
          );
        }
      } catch (error) {
        logger.error(`[BillingWorker] Unhandled error during billing cycle: ${error}`);
      } finally {
        isProcessing = false;
      }
    }

    // Wait for next polling interval
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  logger.info('[BillingWorker] Worker loop stopped.');
}

const shutdown = async (signal: string) => {
  logger.info(`[BillingWorker] Received ${signal}. Initiating graceful shutdown...`);
  isRunning = false;

  // Give in-flight cycle up to 5s to complete
  setTimeout(async () => {
    await prisma.$disconnect();
    logger.info('[BillingWorker] Disconnected from database. Process exiting.');
    process.exit(0);
  }, 3000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

runWorkerLoop().catch(async (err) => {
  logger.fatal(`[BillingWorker] Fatal crash: ${err}`);
  await prisma.$disconnect();
  process.exit(1);
});
