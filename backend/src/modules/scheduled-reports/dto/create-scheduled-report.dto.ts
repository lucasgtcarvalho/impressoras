import { IsString, IsEmail, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class CreateScheduledReportDto {
  @IsUUID()
  clientId: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth: number;

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute: number;
}
