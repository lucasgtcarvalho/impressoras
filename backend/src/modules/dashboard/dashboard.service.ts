import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getGlobal() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const printerActiveFilter = { isActive: true };

    const [
      totalClients,
      activeAgents,
      totalPrinters,
      onlinePrinters,
      openAlerts,
      criticalAlerts,
      totalPagesThisMonth,
      printersByStatus,
      alertsBySeverity,
      topClients,
    ] = await Promise.all([
      this.prisma.client.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.agent.count({ where: { isActive: true, status: 'online' } }),
      this.prisma.printer.count({ where: printerActiveFilter }),
      this.prisma.printer.count({ where: { ...printerActiveFilter, status: 'online' } }),
      this.prisma.alert.count({ where: { status: 'open' } }),
      this.prisma.alert.count({ where: { status: 'open', severity: 'critical' } }),
      this.prisma.printJob.aggregate({
        where: { printedAt: { gte: firstOfMonth } },
        _sum: { pages: true },
      }),
      this.prisma.printer.groupBy({
        by: ['status'],
        _count: true,
        where: printerActiveFilter,
      }),
      this.prisma.alert.groupBy({
        by: ['severity'],
        _count: true,
        where: { status: 'open' },
      }),
      this.prisma.printJob.groupBy({
        by: ['clientId'],
        _sum: { pages: true },
        where: { printedAt: { gte: firstOfMonth } },
        orderBy: { _sum: { pages: 'desc' } },
        take: 5,
      }),
    ]);

    const topClientIds = topClients.map((c) => c.clientId);
    const topClientNames = topClientIds.length
      ? await this.prisma.client.findMany({
          where: { id: { in: topClientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientNameMap = new Map(topClientNames.map((c) => [c.id, c.name]));

    return {
      totalClients,
      activeAgents,
      totalPrinters,
      onlinePrinters,
      offlinePrinters: totalPrinters - onlinePrinters,
      openAlerts,
      criticalAlerts,
      totalPagesThisMonth: totalPagesThisMonth._sum.pages || 0,
      printersByStatus: printersByStatus.map((p) => ({ status: p.status, count: p._count })),
      alertsBySeverity: alertsBySeverity.map((a) => ({ severity: a.severity, count: a._count })),
      topClients: topClients.map((c) => ({
        clientId: c.clientId,
        clientName: clientNameMap.get(c.clientId) || 'Unknown',
        totalPages: c._sum.pages || 0,
      })),
    };
  }

  async getClientDashboard(clientId: string) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalPrinters,
      onlinePrinters,
      errorPrinters,
      activeAgents,
      openAlerts,
      jobsToday,
      pagesThisMonth,
      pagesToday,
      lowSupplies,
      topUsers,
    ] = await Promise.all([
      this.prisma.printer.count({ where: { clientId, isActive: true } }),
      this.prisma.printer.count({ where: { clientId, isActive: true, status: 'online' } }),
      this.prisma.printer.count({ where: { clientId, isActive: true, status: { in: ['error', 'warning'] } } }),
      this.prisma.agent.count({ where: { clientId, isActive: true, status: 'online' } }),
      this.prisma.alert.count({ where: { clientId, status: 'open' } }),
      this.prisma.printJob.count({ where: { clientId, printedAt: { gte: today } } }),
      this.prisma.printJob.aggregate({
        where: { clientId, printedAt: { gte: firstOfMonth } },
        _sum: { pages: true },
      }),
      this.prisma.printJob.aggregate({
        where: { clientId, printedAt: { gte: today } },
        _sum: { pages: true },
      }),
      this.prisma.printerSupplyLevel.findMany({
        where: {
          printer: { clientId, isActive: true },
          levelPercent: { lte: 20 },
          status: { not: 'empty' },
        },
        orderBy: { levelPercent: 'asc' },
        take: 10,
        include: {
          printer: { select: { id: true, name: true, ipAddress: true } },
        },
      }),
      this.prisma.printJob.groupBy({
        by: ['username'],
        where: { clientId, printedAt: { gte: firstOfMonth } },
        _sum: { pages: true, colorPages: true },
        _count: true,
        orderBy: { _sum: { pages: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      totalPrinters,
      onlinePrinters,
      offlinePrinters: totalPrinters - onlinePrinters - errorPrinters,
      errorPrinters,
      activeAgents,
      openAlerts,
      jobsToday,
      pagesThisMonth: pagesThisMonth._sum.pages || 0,
      pagesToday: pagesToday._sum.pages || 0,
      lowSupplies,
      topUsers: topUsers.map((u) => ({
        username: u.username || 'unknown',
        totalPages: u._sum.pages || 0,
        colorPages: u._sum.colorPages || 0,
        totalJobs: u._count,
      })),
    };
  }
}
