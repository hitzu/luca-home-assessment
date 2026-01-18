import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { TenantParamGuard } from '../auth/guards/tenant-param.guard';
import { GovApiClient } from './clients/http/gov-api.client';
import { GovApiCircuitStatusDto, GovBatchResultDto, SendGovApiBatchDto } from './dto/gov-api-dev.dto';

@ApiTags('gov-sync')
@ApiBearerAuth('access-token')
@Controller('/tenants/:tenantId/gov-sync/__dev/gov-api')
@UseGuards(TenantParamGuard, AdminRoleGuard)
export class GovApiClientDevController {
  constructor(private readonly govApiClient: GovApiClient) { }

  @Post('/send-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV] Send a batch to the gov API via GovApiClient' })
  @ApiOkResponse({ description: 'Gov API response', type: GovBatchResultDto })
  @ApiForbiddenResponse({ description: 'Forbidden (tenant mismatch or not admin)' })
  async sendBatch(
    @AuthUser('tenantId') tenantId: string,
    @Body() body: SendGovApiBatchDto,
  ): Promise<GovBatchResultDto> {
    return this.govApiClient.sendBatch(
      tenantId,
      body.periodId,
      body.students ?? [],
    );
  }

  @Get('/circuit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV] Get circuit breaker status for the tenant' })
  @ApiOkResponse({ description: 'Circuit breaker status', type: GovApiCircuitStatusDto })
  @ApiForbiddenResponse({ description: 'Forbidden (tenant mismatch or not admin)' })
  getCircuit(
    @AuthUser('tenantId') tenantId: string,
  ): GovApiCircuitStatusDto {
    return this.govApiClient.getCircuitStatus(tenantId);
  }
}

