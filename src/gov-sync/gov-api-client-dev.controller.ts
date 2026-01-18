import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { TenantParamGuard } from '../auth/guards/tenant-param.guard';
import type {
  GovApiCircuitStatus,
  GovBatchResult,
  StudentPayload,
} from './clients/http/gov-api.client';
import { GovApiClient } from './clients/http/gov-api.client';

@ApiTags('gov-sync')
@ApiBearerAuth('access-token')
@Controller('/tenants/:tenantId/gov-sync/__dev/gov-api')
@UseGuards(TenantParamGuard, AdminRoleGuard)
export class GovApiClientDevController {
  constructor(private readonly govApiClient: GovApiClient) { }

  @Post('/send-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV] Send a batch to the gov API via GovApiClient' })
  @ApiOkResponse({ description: 'Gov API response' })
  async sendBatch(
    @AuthUser('tenantId') tenantId: string,
    @Body()
    body: {
      periodId: string;
      students: StudentPayload[];
    },
  ): Promise<GovBatchResult> {
    return this.govApiClient.sendBatch(
      tenantId,
      body.periodId,
      body.students ?? [],
    );
  }

  @Get('/circuit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV] Get circuit breaker status for the tenant' })
  @ApiOkResponse({ description: 'Circuit breaker status' })
  getCircuit(
    @AuthUser('tenantId') tenantId: string,
  ): GovApiCircuitStatus {
    return this.govApiClient.getCircuitStatus(tenantId);
  }
}

