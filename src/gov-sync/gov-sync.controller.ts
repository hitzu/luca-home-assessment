import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { TenantParamGuard } from '../auth/guards/tenant-param.guard';
import { StartGovSyncJobDto } from './dto/start-gov-sync-job.dto';
import { GovSyncJobResponseDto } from './dto/gov-sync-job-response.dto';
import { GovSyncService } from './gov-sync.service';
import { AuthUser } from '../auth/decorators/auth-user.decorator';

@ApiTags('gov-sync')
@ApiBearerAuth('access-token')
@Controller('/tenants/:tenantId/gov-sync')
@UseGuards(TenantParamGuard)
export class GovSyncController {
  constructor(private readonly govSyncService: GovSyncService) { }

  @Post('/jobs')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a gov sync job for a tenant and period' })
  @ApiCreatedResponse({ type: GovSyncJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden (tenant mismatch or not admin)' })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  async startJob(
    @AuthUser('tenantId') tenantId: string,
    @Body() dto: StartGovSyncJobDto,
  ): Promise<GovSyncJobResponseDto> {
    return this.govSyncService.startJob({
      tenantId,
      periodId: dto.periodId,
    });
  }

  @Get('/jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a gov sync job status' })
  @ApiOkResponse({ type: GovSyncJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden (tenant mismatch)' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async getJob(
    @AuthUser('tenantId') tenantId: string,
    @Param('jobId', ParseIntPipe) jobId: number,
  ): Promise<GovSyncJobResponseDto> {
    return this.govSyncService.getJob({ tenantId, jobId });
  }

  @Post('/jobs/:jobId/process')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger processing for a gov sync job (single attempt)' })
  @ApiOkResponse({ type: GovSyncJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden (tenant mismatch or not admin)' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async processJob(
    @AuthUser('tenantId') tenantId: string,
    @Param('jobId', ParseIntPipe) jobId: number,
  ): Promise<GovSyncJobResponseDto> {
    return this.govSyncService.processJob({ tenantId, jobId });
  }
}

