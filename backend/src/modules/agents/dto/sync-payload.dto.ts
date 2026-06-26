import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class HeartbeatDto {
  @IsOptional()
  @IsNumber()
  cpuUsage?: number;

  @IsOptional()
  @IsNumber()
  memoryUsage?: number;

  @IsOptional()
  @IsNumber()
  diskFreeGb?: number;
}

class PrinterSyncDto {
  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  statusDetail?: string;

  @IsOptional()
  @IsNumber()
  uptimeSeconds?: number;

  @IsOptional()
  @IsBoolean()
  isMonochrome?: boolean;
}

class CounterSyncDto {
  @IsString()
  printerIp: string;

  @IsOptional()
  @IsNumber()
  totalPages?: number;

  @IsOptional()
  @IsNumber()
  monoPages?: number;

  @IsOptional()
  @IsNumber()
  colorPages?: number;

  @IsOptional()
  @IsNumber()
  copyPages?: number;

  @IsOptional()
  @IsNumber()
  scanPages?: number;

  @IsOptional()
  @IsNumber()
  duplexPages?: number;

  @IsOptional()
  @IsDateString()
  collectedAt?: string;
}

class SupplyItemDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  levelPercent?: number;

  @IsOptional()
  @IsNumber()
  levelRemaining?: number;

  @IsOptional()
  @IsNumber()
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

class SuppliesSyncDto {
  @IsString()
  printerIp: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyItemDto)
  supplies: SupplyItemDto[];
}

class EventSyncDto {
  @IsString()
  printerIp: string;

  @IsString()
  eventType: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

class JobSyncDto {
  @IsOptional()
  @IsString()
  jobId?: string;

  @IsString()
  printerIp: string;

  @IsOptional()
  @IsString()
  documentName?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsNumber()
  pages?: number;

  @IsOptional()
  @IsNumber()
  copies?: number;

  @IsOptional()
  @IsNumber()
  colorPages?: number;

  @IsOptional()
  @IsNumber()
  monoPages?: number;

  @IsOptional()
  @IsBoolean()
  isDuplex?: boolean;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  computerName?: string;

  @IsOptional()
  @IsString()
  jobStatus?: string;

  @IsOptional()
  @IsNumber()
  jobSizeBytes?: number;

  @IsOptional()
  @IsDateString()
  printedAt?: string;
}

export class SyncPayloadDto {
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => HeartbeatDto)
  heartbeat?: HeartbeatDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrinterSyncDto)
  printers?: PrinterSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CounterSyncDto)
  counters?: CounterSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuppliesSyncDto)
  supplies?: SuppliesSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventSyncDto)
  events?: EventSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobSyncDto)
  jobs?: JobSyncDto[];
}
