import { IsString, IsOptional, MinLength } from 'class-validator';

export class ActivateAgentDto {
  @IsString()
  activationCode: string;

  @IsString()
  hostname: string;

  @IsOptional()
  @IsString()
  osInfo?: string;

  @IsOptional()
  @IsString()
  localIp?: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
