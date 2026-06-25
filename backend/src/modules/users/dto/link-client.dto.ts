import { IsUUID, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LinkClientDto {
  @IsUUID('4')
  clientId: string;

  @IsEnum(UserRole)
  role: UserRole;
}
