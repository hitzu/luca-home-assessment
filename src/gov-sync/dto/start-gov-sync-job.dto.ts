import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StartGovSyncJobDto {
  @ApiProperty({
    description: 'Period identifier to sync',
    example: '2025-Q1',
    maxLength: 32,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  periodId!: string;
}

