import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('global')
  @Roles('super_admin', 'admin')
  getGlobal() {
    return this.dashboardService.getGlobal();
  }

  @Get('client/:clientId')
  getClientDashboard(@Param('clientId') clientId: string) {
    return this.dashboardService.getClientDashboard(clientId);
  }
}
