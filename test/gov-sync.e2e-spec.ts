import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('GovSync (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    jest.setTimeout(60000);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address();
    const port =
      typeof address === 'string'
        ? Number(address.split(':').pop())
        : (address?.port as number);
    baseUrl = `http://127.0.0.1:${port}`;
    process.env.GOV_API_BASE_URL = `${baseUrl}/__mock/gov-api`;
    process.env.GOV_API_TIMEOUT_MS = '50';
    process.env.GOV_API_CB_FAILURE_THRESHOLD = '2';
    process.env.GOV_API_CB_OPEN_MS = '5000';
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const signupAdmin = async (tenantId: number): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        tenantId,
        email: `admin-${tenantId}@school.edu`,
        fullName: `Admin ${tenantId}`,
        role: 'ADMIN',
      })
      .expect(201);
    return res.body.token as string;
  };

  const setMockMode = async (mode: 'ok' | 'fail' | 'timeout'): Promise<void> => {
    await request(app.getHttpServer())
      .post('/__mock/gov-api/mode')
      .send({ mode })
      .expect(200);
  };

  it('creates a job as ADMIN for the tenant', async () => {
    // Arrange
    const token = await signupAdmin(1);

    // Act
    const res = await request(app.getHttpServer())
      .post('/tenants/1/gov-sync/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodId: '2025-Q1' })
      .expect(201);

    // Assert
    expect(res.body.jobId).toBeDefined();
    expect(res.body.status).toBe('QUEUED');
  });

  it('fails to create a job for another tenant (403)', async () => {
    // Arrange
    const token = await signupAdmin(1);

    // Act / Assert
    await request(app.getHttpServer())
      .post('/tenants/2/gov-sync/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodId: '2025-Q1' })
      .expect(403);
  });

  it('processes a job once with mock gov in ok mode -> COMPLETED', async () => {
    // Arrange
    const token = await signupAdmin(1);
    const created = await request(app.getHttpServer())
      .post('/tenants/1/gov-sync/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodId: '2025-Q1' })
      .expect(201);
    const jobId = created.body.jobId as number;
    await setMockMode('ok');

    // Act
    const processed = await request(app.getHttpServer())
      .post(`/tenants/1/gov-sync/jobs/${jobId}/process`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Assert
    expect(processed.body.status).toBe('COMPLETED');
  });

  it('opens circuit breaker after failures and moves job to WAITING_EXTERNAL', async () => {
    // Arrange
    const token = await signupAdmin(1);
    const created = await request(app.getHttpServer())
      .post('/tenants/1/gov-sync/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ periodId: '2025-Q1' })
      .expect(201);
    const jobId = created.body.jobId as number;
    await setMockMode('fail');

    // Act (2 failing attempts -> OPEN)
    await request(app.getHttpServer())
      .post(`/tenants/1/gov-sync/jobs/${jobId}/process`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/tenants/1/gov-sync/jobs/${jobId}/process`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const circuit = await request(app.getHttpServer())
      .get('/tenants/1/gov-sync/__dev/gov-api/circuit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await setMockMode('ok');
    const processedFastFail = await request(app.getHttpServer())
      .post(`/tenants/1/gov-sync/jobs/${jobId}/process`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Assert
    expect(circuit.body.state).toBe('OPEN');
    expect(processedFastFail.body.status).toBe('WAITING_EXTERNAL');
  });
});

