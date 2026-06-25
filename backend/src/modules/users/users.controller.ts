import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LinkClientDto } from './dto/link-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles('super_admin', 'admin')
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll({
      page,
      limit,
      search,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/clients')
  @Roles('super_admin', 'admin')
  linkClient(@Param('id') id: string, @Body() dto: LinkClientDto) {
    return this.usersService.linkClient(id, dto);
  }

  @Delete(':id/clients/:clientId')
  @Roles('super_admin', 'admin')
  unlinkClient(@Param('id') id: string, @Param('clientId') clientId: string) {
    return this.usersService.unlinkClient(id, clientId);
  }

  @Put(':id/clients/:clientId')
  @Roles('super_admin', 'admin')
  updateLinkRole(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
    @Body('role') role: string,
  ) {
    return this.usersService.updateLinkRole(id, clientId, role);
  }
}
