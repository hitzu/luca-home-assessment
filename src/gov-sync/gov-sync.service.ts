import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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

