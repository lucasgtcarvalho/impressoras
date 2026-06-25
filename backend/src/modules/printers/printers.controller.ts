import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrintersService } from './printers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('printers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintersController {
  constructor(private printersService: PrintersService) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('manufacturer') manufacturer?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.printersService.findAll({
      page, limit, clientId, status, search, manufacturer, agentId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.printersService.findById(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: { displayName?: string; location?: string; notes?: string },
  ) {
    return this.printersService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.printersService.remove(id);
  }

  @Get(':id/status-history')
  getStatusHistory(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.printersService.getStatusHistory(id, limit);
  }

  @Get(':id/counter-history')
  getCounterHistory(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.printersService.getCounterHistory(id, limit);
  }

  @Get(':id/supplies')
  getSupplies(@Param('id') id: string) {
    return this.printersService.getSupplies(id);
  }

  @Get(':id/events')
  getEvents(
    @Param('id') id: string,
    @Query('severity') severity?: string,
    @Query('isResolved') isResolved?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.printersService.getEvents(id, {
      severity,
      isResolved: isResolved !== undefined ? isResolved === 'true' : undefined,
      page,
      limit,
    });
  }
}
