import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import type {
  GovBatchResult,
  StudentPayload,
} from './clients/http/gov-api.client';
import { Public } from '../auth/decorators/public.decorator';

type MockGovApiState = {
  totalRequests: number;
  requestsByTenantId: Record<string, number>;
  mode: MockGovApiMode;
};

type MockGovApiMode = 'ok' | 'fail' | 'timeout';

class SetMockGovApiModeDto {
  @IsIn(['ok', 'fail', 'timeout'])
  mode!: MockGovApiMode;
}

const STATE: MockGovApiState = {
  totalRequests: 0,
  requestsByTenantId: {},
  mode: 'ok',
};

@Public()
@ApiTags('gov-sync')
@Controller('/__mock/gov-api')
export class MockGovApiController {
  @Get('/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[MOCK] Get mock gov API stats' })
  @ApiOkResponse({ description: 'Mock stats' })
  getStats(): MockGovApiState {
    return STATE;
  }

  @Post('/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[MOCK] Reset mock gov API stats and mode' })
  @ApiOkResponse({ description: 'Reset state' })
  reset(): MockGovApiState {
    STATE.totalRequests = 0;
    STATE.requestsByTenantId = {};
    STATE.mode = 'ok';
    return STATE;
  }

  @Post('/mode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[MOCK] Set mock gov API mode (ok | fail | timeout)' })
  @ApiOkResponse({ description: 'Updated state' })
  setMode(@Body() dto: SetMockGovApiModeDto): MockGovApiState {
    STATE.mode = dto.mode;
    return STATE;
  }

  @Post('/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[MOCK] Submit a batch (behavior controlled by mode)' })
  @ApiOkResponse({ description: 'Mock gov API batch response' })
  async batch(
    @Body()
    body: {
      tenantId: string;
      periodId: string;
      students: StudentPayload[];
    },
  ): Promise<GovBatchResult> {
    const tenantId = body.tenantId;
    const periodId = body.periodId;
    const students = body.students ?? [];
    STATE.totalRequests += 1;
    STATE.requestsByTenantId[tenantId] =
      (STATE.requestsByTenantId[tenantId] ?? 0) + 1;
    const periodIdUpper = String(periodId ?? '').toUpperCase();
    const shouldTimeoutByPeriod = periodIdUpper.includes('TIMEOUT');
    const shouldFailByPeriod = periodIdUpper.includes('FAIL');

    if (STATE.mode === 'timeout' || shouldTimeoutByPeriod) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (STATE.mode === 'fail' || shouldFailByPeriod) {
      throw new InternalServerErrorException('Simulated gov API failure');
    }
    const batchId = `batch-${tenantId}-${periodId}-${Date.now()}`;
    return {
      batchId,
      tenantId,
      periodId,
      status: 'ACCEPTED',
      results: students.map((s, idx) => ({
        studentId: s.studentId,
        status: 'ACCEPTED',
        externalRecordId: `${batchId}-rec-${idx + 1}`,
        errorCode: null,
        errorMessage: null,
      })),
    };
  }
}

