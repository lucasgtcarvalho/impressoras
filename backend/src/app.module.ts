import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { AgentsModule } from './modules/agents/agents.module';
import { PrintersModule } from './modules/printers/printers.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    AgentsModule,
    PrintersModule,
    JobsModule,
    AlertsModule,
    DashboardModule,
    AuditModule,
  ],
})
export class AppModule {}
