import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GovSyncJob } from './entities/gov-sync-job.entity';
import { GovSyncResult } from './entities/gov-sync-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GovSyncJob, GovSyncResult])],
})
export class GovSyncModule { }

