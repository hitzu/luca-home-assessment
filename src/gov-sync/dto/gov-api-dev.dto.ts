import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StudentPayloadDto {
  @ApiProperty({ example: 's-1' })
  @IsNotEmpty()
  @IsString()
  studentId!: string;

  @ApiProperty({ example: { gpa: 3.7 } })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class SendGovApiBatchDto {
  @ApiProperty({ example: '2025-Q1' })
  @IsNotEmpty()
  @IsString()
  periodId!: string;

  @ApiProperty({ type: [StudentPayloadDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentPayloadDto)
  students?: StudentPayloadDto[];
}

export class GovBatchResultItemDto {
  @ApiProperty({ example: 's-1' })
  studentId!: string;

  @ApiProperty({ example: 'ACCEPTED', enum: ['ACCEPTED', 'REJECTED'] })
  status!: 'ACCEPTED' | 'REJECTED';

  @ApiProperty({ example: 'rec-1', nullable: true })
  externalRecordId!: string | null;

  @ApiProperty({ example: 'E_BAD', nullable: true })
  errorCode!: string | null;

  @ApiProperty({ example: 'Bad payload', nullable: true })
  errorMessage!: string | null;
}

export class GovBatchResultDto {
  @ApiProperty({ example: 'batch-Tenant1-2025-Q1-1700000000000' })
  batchId!: string;

  @ApiProperty({ example: 'Tenant1' })
  tenantId!: string;

  @ApiProperty({ example: '2025-Q1' })
  periodId!: string;

  @ApiProperty({ example: 'ACCEPTED', enum: ['ACCEPTED', 'REJECTED'] })
  status!: 'ACCEPTED' | 'REJECTED';

  @ApiProperty({ type: [GovBatchResultItemDto] })
  results!: GovBatchResultItemDto[];
}

export class GovApiCircuitStatusDto {
  @ApiProperty({ example: 'Tenant1' })
  tenantId!: string;

  @ApiProperty({ example: 'CLOSED', enum: ['CLOSED', 'OPEN', 'HALF_OPEN'] })
  state!: 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  @ApiProperty({ example: 0 })
  consecutiveFailures!: number;

  @ApiProperty({ example: null, nullable: true })
  openedAtMs!: number | null;

  @ApiProperty({ example: false })
  probeInFlight!: boolean;

  @ApiProperty({ example: null, nullable: true })
  openMsRemaining!: number | null;
}

