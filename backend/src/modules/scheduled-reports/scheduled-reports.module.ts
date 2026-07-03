import { Module } from '@nestjs/common';
import { ScheduledReportsController } from './scheduled-reports.controller';
import { ScheduledReportsService } from './scheduled-reports.service';

@Module({
  controllers: [ScheduledReportsController],
  providers: [ScheduledReportsService],
  exports: [ScheduledReportsService],
})
export class ScheduledReportsModule {}
