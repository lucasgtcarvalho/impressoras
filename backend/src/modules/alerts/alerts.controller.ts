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
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get('alerts')
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('clientId') clientId?: string,
    @Query('printerId') printerId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.alertsService.findAll({
      page, limit, clientId, printerId, severity, status, dateFrom, dateTo,
    });
  }

  @Put('alerts/:id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.alertsService.acknowledge(id);
  }

  @Put('alerts/:id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('note') note?: string,
  ) {
    return this.alertsService.resolve(id, userId, note);
  }

  @Get('alerts/rules')
  getRules(@Query('clientId') clientId: string) {
    return this.alertsService.getRules(clientId);
  }

  @Post('alerts/rules')
  createRule(
    @Query('clientId') clientId: string,
    @Body() data: any,
  ) {
    return this.alertsService.createRule(clientId, data);
  }

  @Put('alerts/rules/:id')
  updateRule(@Param('id') id: string, @Body() data: any) {
    return this.alertsService.updateRule(id, data);
  }

  @Delete('alerts/rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.alertsService.deleteRule(id);
  }
}
