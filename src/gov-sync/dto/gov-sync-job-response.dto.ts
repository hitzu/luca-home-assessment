import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GOV_SYNC_JOB_STATUS } from '../types/gov-sync-job-status.type';

export class GovSyncJobAggregatesDto {
  @ApiProperty({ example: 10 })
  totalItems!: number;

  @ApiProperty({ example: 7 })
  processedItems!: number;

  @ApiProperty({ example: 1 })
  deadItems!: number;
}

export class GovSyncJobResponseDto {
  @ApiProperty({ description: 'Gov sync job identifier', example: 123 })
  jobId!: number;

  @ApiProperty({ description: 'Tenant identifier', example: 'Tenant1' })
  tenantId!: string;

  @ApiProperty({ description: 'Period identifier', example: '2025-Q1' })
  periodId!: string;

  @ApiProperty({ enum: GOV_SYNC_JOB_STATUS, example: GOV_SYNC_JOB_STATUS.QUEUED })
  status!: GOV_SYNC_JOB_STATUS;

  @ApiProperty({ example: '2026-01-17T12:00:00.000Z' })
  scheduledAt!: string;

  @ApiPropertyOptional({ example: '2026-01-17T12:01:00.000Z' })
  startedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-01-17T12:02:00.000Z' })
  completedAt?: string | null;

  @ApiPropertyOptional({ type: GovSyncJobAggregatesDto })
  aggregates?: GovSyncJobAggregatesDto;

  constructor(params: {
    jobId: number;
    tenantId: string;
    periodId: string;
    status: GOV_SYNC_JOB_STATUS;
    scheduledAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    aggregates?: GovSyncJobAggregatesDto;
  }) {
    this.jobId = params.jobId;
    this.tenantId = params.tenantId;
    this.periodId = params.periodId;
    this.status = params.status;
    this.scheduledAt = params.scheduledAt;
    this.startedAt = params.startedAt;
    this.completedAt = params.completedAt;
    this.aggregates = params.aggregates;
  }
}

