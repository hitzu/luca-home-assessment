import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsNumber } from 'class-validator';
import type { DevTokenRole } from '../guards/dev-token.guard';

export class DevLoginResponseDto {
  @ApiProperty({
    example: 'DEV.v1.Tenant1.42.TEACHER.1733472000',
    description: 'Dev-only token. NOT for production use.',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: '42' })
  @IsNumber()
  @IsNotEmpty()
  userId!: number;

  @ApiProperty({ example: 'tenant-123' })
  @IsNumber()
  @IsNotEmpty()
  tenantId!: number;

  @ApiProperty({
    example: 'ADMIN',
    enum: ['TEACHER', 'PRINCIPAL', 'ADMIN'],
  })
  @IsString()
  @IsIn(['TEACHER', 'PRINCIPAL', 'ADMIN'])
  role!: DevTokenRole;
}
