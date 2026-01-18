import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GovSyncJob } from './entities/gov-sync-job.entity';
import { GovSyncResult } from './entities/gov-sync-result.entity';
import { GovSyncController } from './gov-sync.controller';
import { GovSyncService } from './gov-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([GovSyncJob, GovSyncResult])],
  controllers: [GovSyncController],
  providers: [GovSyncService],
})
export class GovSyncModule { }

