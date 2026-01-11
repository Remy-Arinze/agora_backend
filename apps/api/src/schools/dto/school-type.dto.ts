import { ApiProperty } from '@nestjs/swagger';

export class SchoolTypeContextDto {
  @ApiProperty({ description: 'Has primary level' })
  hasPrimary: boolean;

  @ApiProperty({ description: 'Has secondary level' })
  hasSecondary: boolean;

  @ApiProperty({ description: 'Has tertiary level' })
  hasTertiary: boolean;

  @ApiProperty({ description: 'Has multiple school types' })
  isMixed: boolean;

  @ApiProperty({
    description: 'Available school types',
    enum: ['PRIMARY', 'SECONDARY', 'TERTIARY'],
    isArray: true,
  })
  availableTypes: ('PRIMARY' | 'SECONDARY' | 'TERTIARY')[];

  @ApiProperty({
    description: 'Primary type (if single type) or first type (if mixed)',
    enum: ['PRIMARY', 'SECONDARY', 'TERTIARY', 'MIXED'],
    nullable: true,
  })
  primaryType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'MIXED';
}
