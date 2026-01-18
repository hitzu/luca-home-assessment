import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GovApiClient } from './clients/http/gov-api.client';
import { GovSyncJob } from './entities/gov-sync-job.entity';
import { GovSyncResult } from './entities/gov-sync-result.entity';
import { GOV_SYNC_JOB_STATUS } from './types/gov-sync-job-status.type';
import { GOV_SYNC_RESULT_STATUS } from './types/gov-sync-result-status.type';
import {
  GovSyncJobAggregatesDto,
  GovSyncJobResponseDto,
} from './dto/gov-sync-job-response.dto';

@Injectable()
export class GovSyncService {
  constructor(
    @InjectRepository(GovSyncJob)
    private readonly jobRepository: Repository<GovSyncJob>,
    @InjectRepository(GovSyncResult)
    private readonly resultRepository: Repository<GovSyncResult>,
    private readonly govApiClient: GovApiClient,
  ) { }

  async startJob(params: {
    tenantId: string;
    periodId: string;
  }): Promise<GovSyncJobResponseDto> {
    const { tenantId, periodId } = params;

    if (!periodId) {
      throw new BadRequestException('periodId is required');
    }

    const tenantNumericId = this.parseTenantNumericId(tenantId);
    const window = this.parseQuarterWindow(periodId);

    const job = this.jobRepository.create({
      tenantId: tenantNumericId,
      periodId,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      status: GOV_SYNC_JOB_STATUS.QUEUED,
      scheduledAt: new Date(),
      startedAt: null,
      completedAt: null,
    });

    const saved = await this.jobRepository.save(job);

    return new GovSyncJobResponseDto({
      jobId: saved.id,
      tenantId,
      periodId: saved.periodId,
      status: saved.status,
      scheduledAt: saved.scheduledAt.toISOString(),
      startedAt: saved.startedAt?.toISOString() ?? null,
      completedAt: saved.completedAt?.toISOString() ?? null,
    });
  }

  async processJob(params: {
    tenantId: string;
    jobId: number;
  }): Promise<GovSyncJobResponseDto> {
    const { tenantId, jobId } = params;
    const tenantNumericId = this.parseTenantNumericId(tenantId);
    const job = await this.jobRepository.findOne({
      where: { id: jobId, tenantId: tenantNumericId },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.status === GOV_SYNC_JOB_STATUS.COMPLETED) {
      return this.getJob({ tenantId, jobId });
    }
    const now = new Date();
    const startedAt = job.startedAt ?? now;
    await this.jobRepository.update(
      { id: jobId, tenantId: tenantNumericId },
      { status: GOV_SYNC_JOB_STATUS.RUNNING, startedAt, completedAt: null },
    );
    const studentId = '00000000-0000-0000-0000-000000000001';
    const students = [{ studentId, payload: { jobId } }];
    try {
      const result = await this.govApiClient.sendBatch(
        tenantId,
        job.periodId,
        students,
      );
      await this.resultRepository.save({
        jobId: job.id,
        tenantId: tenantNumericId,
        studentId,
        periodId: job.periodId,
        status: GOV_SYNC_RESULT_STATUS.ACCEPTED,
        attemptNumber: 1,
        externalRecordId: result.results?.[0]?.externalRecordId ?? null,
        idempotencyKey: `job-${job.id}-student-${studentId}-attempt-1`,
        errorCode: null,
        errorMessage: null,
        rawRequest: { tenantId, periodId: job.periodId, students },
        rawResponse: result as unknown as Record<string, unknown>,
        syncedAt: now,
        nextRetryAt: null,
      });
      await this.jobRepository.update(
        { id: jobId, tenantId: tenantNumericId },
        { status: GOV_SYNC_JOB_STATUS.COMPLETED, completedAt: now },
      );
      return this.getJob({ tenantId, jobId });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException(
          `Gov API circuit breaker open for tenant ${tenantId}`,
        );
      }

      const nextRetryAt = this.computeNextRetryAt(tenantId, error);
      await this.resultRepository.save({
        jobId: job.id,
        tenantId: tenantNumericId,
        studentId,
        periodId: job.periodId,
        status: GOV_SYNC_RESULT_STATUS.WAITING_EXTERNAL,
        attemptNumber: 1,
        externalRecordId: null,
        idempotencyKey: `job-${job.id}-student-${studentId}-waiting-${Date.now()}`,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        rawRequest: { tenantId, periodId: job.periodId, students },
        rawResponse: null,
        syncedAt: null,
        nextRetryAt,
      });
      await this.jobRepository.update(
        { id: jobId, tenantId: tenantNumericId },
        { status: GOV_SYNC_JOB_STATUS.WAITING_EXTERNAL, completedAt: null },
      );
      return this.getJob({ tenantId, jobId });
    }
  }

  async getJob(params: {
    tenantId: string;
    jobId: number;
  }): Promise<GovSyncJobResponseDto> {
    const { tenantId, jobId } = params;
    const tenantNumericId = this.parseTenantNumericId(tenantId);

    const job = await this.jobRepository.findOne({
      where: { id: jobId, tenantId: tenantNumericId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const aggregates = await this.computeAggregates({
      tenantId: tenantNumericId,
      jobId,
    });

    return new GovSyncJobResponseDto({
      jobId: job.id,
      tenantId,
      periodId: job.periodId,
      status: job.status,
      scheduledAt: job.scheduledAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      aggregates,
    });
  }

  private async computeAggregates(params: {
    tenantId: number;
    jobId: number;
  }): Promise<GovSyncJobAggregatesDto | undefined> {
    const rows = await this.resultRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.job_id = :jobId', { jobId: params.jobId })
      .andWhere('r.tenant_id = :tenantId', { tenantId: params.tenantId })
      .groupBy('r.status')
      .getRawMany<{ status: GOV_SYNC_RESULT_STATUS; count: string }>();

    if (!rows.length) {
      return undefined;
    }

    const totalItems = rows.reduce((acc, r) => acc + Number(r.count), 0);
    const deadItems =
      rows.find((r) => r.status === GOV_SYNC_RESULT_STATUS.DEAD)?.count ?? '0';
    const waitingExternal =
      rows.find((r) => r.status === GOV_SYNC_RESULT_STATUS.WAITING_EXTERNAL)
        ?.count ?? '0';

    const processedItems =
      totalItems - Number(waitingExternal);

    return {
      totalItems,
      processedItems,
      deadItems: Number(deadItems),
    };
  }

  private parseTenantNumericId(tenantId: string): number {
    const match = tenantId.match(/^Tenant(?<id>\d+)$/);
    const raw = match?.groups?.id ?? (tenantId.match(/^\d+$/) ? tenantId : null);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('Invalid tenantId format');
    }
    return parsed;
  }

  private computeNextRetryAt(tenantId: string, error: unknown): Date | null {
    const now = Date.now();
    if (error instanceof ServiceUnavailableException) {
      const circuit = this.govApiClient.getCircuitStatus(tenantId);
      const delayMs = circuit.openMsRemaining ?? 5000;
      return new Date(now + delayMs);
    }
    if (error instanceof BadGatewayException || error instanceof Error) {
      return new Date(now + 5000);
    }
    return null;
  }

  private parseQuarterWindow(periodId: string): {
    windowStart: string;
    windowEnd: string;
  } {
    const match = periodId.match(/^(?<year>\d{4})-Q(?<quarter>[1-4])$/);
    const year = match?.groups?.year ? Number(match.groups.year) : NaN;
    const quarter = match?.groups?.quarter ? Number(match.groups.quarter) : NaN;

    if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
      throw new BadRequestException('Invalid periodId format (expected YYYY-Q#)');
    }

    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;

    const windowStart = new Date(Date.UTC(year, startMonth, 1));
    const windowEnd = new Date(Date.UTC(year, endMonth + 1, 0));

    return {
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
    };
  }
}

