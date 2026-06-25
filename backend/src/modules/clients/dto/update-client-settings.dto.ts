import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsString,
} from 'class-validator';

export class UpdateClientSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  collectionIntervalSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3650)
  dataRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  alertOfflineMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertTonerLowThreshold?: number;

  @IsOptional()
  @IsNumber()
  costPerPageMono?: number;

  @IsOptional()
  @IsNumber()
  costPerPageColor?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
