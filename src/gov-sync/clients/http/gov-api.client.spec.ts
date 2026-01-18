import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { GovApiClient } from './gov-api.client';
import { MockGovApiController } from '../../mock-gov-api.controller';

describe('GovApiClient', () => {
  let app: INestApplication;
  let client: GovApiClient;
  let baseUrl: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MockGovApiController],
      providers: [GovApiClient],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address();
    const port =
      typeof address === 'string'
        ? Number(address.split(':').pop())
        : (address?.port as number);
    baseUrl = `http://127.0.0.1:${port}/__mock/gov-api`;
    process.env.GOV_API_BASE_URL = baseUrl;
    process.env.GOV_API_TIMEOUT_MS = '75';
    process.env.GOV_API_CB_FAILURE_THRESHOLD = '2';
    process.env.GOV_API_CB_OPEN_MS = '150';
    client = module.get<GovApiClient>(GovApiClient);
    await fetch(`${baseUrl}/reset`, { method: 'POST' });
  });

  afterEach(async () => {
    process.env = originalEnv;
    await app.close();
  });

  it('sends a batch successfully to the gov API', async () => {
    // Arrange
    const tenantId = 'Tenant1';
    const periodId = '2025-Q1';
    const students = [
      { studentId: 's-1', payload: { a: 1 } },
      { studentId: 's-2', payload: { a: 2 } },
    ];

    // Act
    const result = await client.sendBatch(tenantId, periodId, students);

    // Assert
    expect(result.status).toBe('ACCEPTED');
    expect(result.tenantId).toBe(tenantId);
    expect(result.periodId).toBe(periodId);
    expect(result.results).toHaveLength(2);
  });

  it('opens the circuit after repeated failures and then fails fast without calling the gov API', async () => {
    // Arrange
    const tenantId = 'Tenant9';
    const students = [{ studentId: 's-1', payload: {} }];
    const statsBefore = await (await fetch(`${baseUrl}/stats`)).json();
    await fetch(`${baseUrl}/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'fail' }),
    });

    // Act
    await expect(
      client.sendBatch(tenantId, '2025-Q1', students),
    ).rejects.toBeDefined();
    await expect(
      client.sendBatch(tenantId, '2025-Q2', students),
    ).rejects.toBeDefined();
    const statsAfterFailures = await (await fetch(`${baseUrl}/stats`)).json();
    await expect(
      client.sendBatch(tenantId, '2025-Q3', students),
    ).rejects.toBeDefined();
    const statsAfterFastFail = await (await fetch(`${baseUrl}/stats`)).json();

    // Assert
    expect(client.getCircuitStatus(tenantId).state).toBe('OPEN');
    expect(statsAfterFailures.totalRequests).toBe(statsBefore.totalRequests + 2);
    expect(statsAfterFastFail.totalRequests).toBe(statsAfterFailures.totalRequests);
  });

  it('allows a probe after the open window and closes the circuit after a success', async () => {
    // Arrange
    const tenantId = 'Tenant2';
    const students = [{ studentId: 's-1', payload: {} }];
    await fetch(`${baseUrl}/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'fail' }),
    });
    await expect(
      client.sendBatch(tenantId, '2025-Q1', students),
    ).rejects.toBeDefined();
    await expect(
      client.sendBatch(tenantId, '2025-Q2', students),
    ).rejects.toBeDefined();

    // Act
    await new Promise((resolve) => setTimeout(resolve, 175));
    await fetch(`${baseUrl}/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'ok' }),
    });
    const result = await client.sendBatch(tenantId, '2025-Q3', students);

    // Assert
    expect(result.status).toBe('ACCEPTED');
    expect(result.results).toHaveLength(1);
  });

  it('counts a timeout as a failure and can trip the circuit breaker', async () => {
    // Arrange
    const tenantId = 'Tenant3';
    const students = [{ studentId: 's-1', payload: {} }];
    await fetch(`${baseUrl}/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'timeout' }),
    });

    // Act / Assert
    await expect(
      client.sendBatch(tenantId, '2025-Q1', students),
    ).rejects.toBeDefined();
    await expect(
      client.sendBatch(tenantId, '2025-Q2', students),
    ).rejects.toBeDefined();
    await expect(
      client.sendBatch(tenantId, '2025-Q3', students),
    ).rejects.toBeDefined();
  });
});

