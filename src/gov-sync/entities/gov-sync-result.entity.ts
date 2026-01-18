import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { GOV_SYNC_RESULT_STATUS } from '../types/gov-sync-result-status.type';
import { GovSyncJob } from './gov-sync-job.entity';

@Entity('gov_sync_results')
@Unique('ux_gov_sync_results_tenant_idempotency', ['tenantId', 'idempotencyKey'])
@Index('ix_gov_sync_results_job_status', ['jobId', 'status'])
export class GovSyncResult extends BaseTimeEntity {
  @Column('integer', { name: 'job_id' })
  jobId!: number;

  @ManyToOne(() => GovSyncJob, { nullable: false })
  @JoinColumn({ name: 'job_id' })
  job!: GovSyncJob;

  @Column('integer', { name: 'tenant_id' })
  tenantId!: number;

  @Column('uuid', { name: 'student_id' })
  studentId!: string;

  @Column('varchar', { name: 'period_id', length: 32 })
  periodId!: string;

  @Column({
    type: 'enum',
    enum: GOV_SYNC_RESULT_STATUS,
    enumName: 'GOV_SYNC_RESULT_STATUS',
  })
  status!: GOV_SYNC_RESULT_STATUS;

  @Column('integer', { name: 'attempt_number', default: 1 })
  attemptNumber!: number;

  @Column('varchar', { name: 'external_record_id', length: 128, nullable: true })
  externalRecordId!: string | null;

  @Column('varchar', { name: 'idempotency_key', length: 128 })
  idempotencyKey!: string;

  @Column('varchar', { name: 'error_code', length: 64, nullable: true })
  errorCode!: string | null;

  @Column('text', { name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column('jsonb', { name: 'raw_request', nullable: true })
  rawRequest!: Record<string, unknown> | null;

  @Column('jsonb', { name: 'raw_response', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @Column('timestamptz', { name: 'synced_at', nullable: true })
  syncedAt!: Date | null;

  @Column('timestamptz', { name: 'next_retry_at', nullable: true })
  nextRetryAt!: Date | null;
}

