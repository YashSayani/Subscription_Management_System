import { Router } from 'express';
import { prisma } from '@brightloop/database';
import { HealthResponse } from '@brightloop/shared';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const startTime = Date.now();
  let dbConnected = false;
  let dbLatency = 0;
  let currentDb = 'unknown';

  try {
    const result = await prisma.$queryRaw<Array<{ db_name: string; ping: number }>>`
      SELECT current_database() AS db_name, 1 AS ping;
    `;

    if (result && result.length > 0) {
      dbConnected = true;
      currentDb = result[0].db_name;
    }
  } catch {
    dbConnected = false;
  } finally {
    dbLatency = Date.now() - startTime;
  }

  const responsePayload: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: {
      connected: dbConnected,
      latencyMs: dbLatency,
      databaseName: currentDb,
    },
    environment: env.NODE_ENV,
  };

  if (!dbConnected) {
    res.status(503).json({
      success: false,
      data: responsePayload,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Could not connect to PostgreSQL database',
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: responsePayload,
  });
});
