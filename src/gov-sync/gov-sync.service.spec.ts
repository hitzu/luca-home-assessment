import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { GovSyncJob } from './entities/gov-sync-job.entity';
import { GovSyncResult } from './entities/gov-sync-result.entity';
import { GOV_SYNC_JOB_STATUS } from './types/gov-sync-job-status.type';
import { GOV_SYNC_RESULT_STATUS } from './types/gov-sync-result-status.type';
import { GovSyncService } from './gov-sync.service';

describe('GovSyncService', () => {
  let service: GovSyncService;
  let jobRepo: Repository<GovSyncJob>;
  let resultRepo: Repository<GovSyncResult>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovSyncService,
        {
          provide: getRepositoryToken(GovSyncJob),
          useValue: TestDataSource.getRepository(GovSyncJob),
        },
        {
          provide: getRepositoryToken(GovSyncResult),
          useValue: TestDataSource.getRepository(GovSyncResult),
        },
      ],
    }).compile();

    service = module.get<GovSyncService>(GovSyncService);
    jobRepo = TestDataSource.getRepository(GovSyncJob);
    resultRepo = TestDataSource.getRepository(GovSyncResult);
  });

  describe('startJob', () => {
    it('creates a QUEUED job with scheduledAt=now and computed window dates', async () => {
      // Arrange
      const tenantId = 'Tenant1';
      const periodId = '2025-Q1';

      // Act
      const response = await service.startJob({ tenantId, periodId });
      const persisted = await jobRepo.findOne({ where: { id: response.jobId } });

      // Assert
      expect(response).toEqual(
        expect.objectContaining({
          tenantId,
          periodId,
          status: GOV_SYNC_JOB_STATUS.QUEUED,
        }),
      );
      expect(persisted).not.toBeNull();
      expect(persisted?.tenantId).toBe(1);
      expect(persisted?.periodId).toBe(periodId);
      expect(persisted?.status).toBe(GOV_SYNC_JOB_STATUS.QUEUED);
      expect(persisted?.scheduledAt).toBeInstanceOf(Date);
      expect(persisted?.windowStart).toBe('2025-01-01');
      expect(persisted?.windowEnd).toBe('2025-03-31');
    });
  });

  describe('getJob', () => {
    it('throws NotFoundException when job is not in tenant', async () => {
      // Arrange
      const job = await jobRepo.save({
        tenantId: 2,
        periodId: '2025-Q1',
        windowStart: '2025-01-01',
        windowEnd: '2025-03-31',
        status: GOV_SYNC_JOB_STATUS.QUEUED,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
      });

      // Act / Assert
      await expect(
        service.getJob({ tenantId: 'Tenant1', jobId: job.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns aggregates when results exist', async () => {
      // Arrange
      const job = await jobRepo.save({
        tenantId: 1,
        periodId: '2025-Q1',
        windowStart: '2025-01-01',
        windowEnd: '2025-03-31',
        status: GOV_SYNC_JOB_STATUS.RUNNING,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
      });

      await resultRepo.save([
        {
          jobId: job.id,
          tenantId: 1,
          studentId: '00000000-0000-0000-0000-000000000001',
          periodId: '2025-Q1',
          status: GOV_SYNC_RESULT_STATUS.ACCEPTED,
          attemptNumber: 1,
          externalRecordId: null,
          idempotencyKey: 'k-1',
          errorCode: null,
          errorMessage: null,
          rawRequest: null,
          rawResponse: null,
          syncedAt: null,
          nextRetryAt: null,
        },
        {
          jobId: job.id,
          tenantId: 1,
          studentId: '00000000-0000-0000-0000-000000000002',
          periodId: '2025-Q1',
          status: GOV_SYNC_RESULT_STATUS.WAITING_EXTERNAL,
          attemptNumber: 1,
          externalRecordId: null,
          idempotencyKey: 'k-2',
          errorCode: null,
          errorMessage: null,
          rawRequest: null,
          rawResponse: null,
          syncedAt: null,
          nextRetryAt: null,
        },
        {
          jobId: job.id,
          tenantId: 1,
          studentId: '00000000-0000-0000-0000-000000000003',
          periodId: '2025-Q1',
          status: GOV_SYNC_RESULT_STATUS.DEAD,
          attemptNumber: 1,
          externalRecordId: null,
          idempotencyKey: 'k-3',
          errorCode: 'E_DEAD',
          errorMessage: 'dead',
          rawRequest: null,
          rawResponse: null,
          syncedAt: null,
          nextRetryAt: null,
        },
      ]);

      // Act
      const response = await service.getJob({ tenantId: 'Tenant1', jobId: job.id });

      // Assert
      expect(response.aggregates).toEqual({
        totalItems: 3,
        processedItems: 2,
        deadItems: 1,
      });
    });
  });
});

