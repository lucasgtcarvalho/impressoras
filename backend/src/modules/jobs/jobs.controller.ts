import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('clientId') clientId?: string,
    @Query('printerId') printerId?: string,
    @Query('username') username?: string,
    @Query('computerName') computerName?: string,
    @Query('documentType') documentType?: string,
    @Query('jobStatus') jobStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.jobsService.findAll({
      page, limit, clientId, printerId, username, computerName,
      documentType, jobStatus, dateFrom, dateTo, sort, order,
    });
  }

  @Get('stats/by-user')
  getStatsByUser(
    @Query('clientId') clientId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: number,
  ) {
    return this.jobsService.getStatsByUser({ clientId, dateFrom, dateTo, limit });
  }

  @Get('stats/by-printer')
  getStatsByPrinter(
    @Query('clientId') clientId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: number,
  ) {
    return this.jobsService.getStatsByPrinter({ clientId, dateFrom, dateTo, limit });
  }

  @Get('stats/daily')
  getDailyStats(
    @Query('clientId') clientId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.jobsService.getDailyStats({ clientId, dateFrom, dateTo });
  }
}
