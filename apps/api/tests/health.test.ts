import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '@brightloop/database';
import { HealthResponseSchema } from '@brightloop/shared';

describe('GET /api/health', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return 200 OK with connected database status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const parsed = HealthResponseSchema.safeParse(res.body.data);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.status).toBe('ok');
      expect(parsed.data.database.connected).toBe(true);
      expect(parsed.data.database.databaseName).toBe('brightloop');
      expect(parsed.data.database.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(app).get('/api/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
