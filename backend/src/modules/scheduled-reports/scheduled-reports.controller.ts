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
import { ScheduledReportsService } from './scheduled-reports.service';
import { CreateScheduledReportDto } from './dto/create-scheduled-report.dto';
import { UpdateScheduledReportDto } from './dto/update-scheduled-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('scheduled-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduledReportsController {
  constructor(private service: ScheduledReportsService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateScheduledReportDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('clientId') clientId?: string) {
    return this.service.findAll(clientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateScheduledReportDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
