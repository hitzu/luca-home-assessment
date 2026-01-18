import { Column, Entity, Index } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { GOV_SYNC_JOB_STATUS } from '../types/gov-sync-job-status.type';

@Entity('gov_sync_jobs')
@Index('ix_gov_sync_jobs_tenant_status_scheduled', [
  'tenantId',
  'status',
  'scheduledAt',
])
export class GovSyncJob extends BaseTimeEntity {
  @Column('integer', { name: 'tenant_id' })
  tenantId!: number;

  @Column('varchar', { name: 'period_id', length: 32 })
  periodId!: string;

  @Column('date', { name: 'window_start' })
  windowStart!: string;

  @Column('date', { name: 'window_end' })
  windowEnd!: string;

  @Column({
    type: 'enum',
    enum: GOV_SYNC_JOB_STATUS,
    enumName: 'GOV_SYNC_JOB_STATUS',
  })
  status!: GOV_SYNC_JOB_STATUS;

  @Column('timestamptz', { name: 'scheduled_at' })
  scheduledAt!: Date;

  @Column('timestamptz', { name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column('timestamptz', { name: 'completed_at', nullable: true })
  completedAt!: Date | null;
}

