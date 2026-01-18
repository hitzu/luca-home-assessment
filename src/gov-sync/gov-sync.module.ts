import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GovSyncJob } from './entities/gov-sync-job.entity';
import { GovSyncResult } from './entities/gov-sync-result.entity';
import { GovSyncController } from './gov-sync.controller';
import { GovSyncService } from './gov-sync.service';
import { GovApiClient } from './clients/http/gov-api.client';
import { MockGovApiController } from './mock-gov-api.controller';
import { GovApiClientDevController } from './gov-api-client-dev.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GovSyncJob, GovSyncResult])],
  controllers: [GovSyncController, MockGovApiController, GovApiClientDevController],
  providers: [GovSyncService, GovApiClient],
})
export class GovSyncModule { }

