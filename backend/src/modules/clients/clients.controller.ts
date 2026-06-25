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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientSettingsDto } from './dto/update-client-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.clientsService.findAll({ page, limit, search, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Post(':id/regenerate-token')
  @Roles('super_admin', 'admin')
  regenerateToken(@Param('id') id: string) {
    return this.clientsService.regenerateToken(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.clientsService.getStats(id);
  }

  @Put(':id/settings')
  @Roles('super_admin', 'admin')
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateClientSettingsDto,
  ) {
    return this.clientsService.updateSettings(id, dto);
  }
}
