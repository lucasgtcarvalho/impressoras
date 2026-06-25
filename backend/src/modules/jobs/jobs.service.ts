import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    clientId?: string;
    printerId?: string;
    username?: string;
    computerName?: string;
    documentType?: string;
    jobStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.clientId) where.clientId = params.clientId;
    if (params.printerId) where.printerId = params.printerId;
    if (params.username) where.username = { contains: params.username, mode: 'insensitive' };
    if (params.computerName) where.computerName = { contains: params.computerName, mode: 'insensitive' };
    if (params.documentType) where.documentType = params.documentType;
    if (params.jobStatus) where.jobStatus = params.jobStatus;
    if (params.dateFrom || params.dateTo) {
      where.printedAt = {};
      if (params.dateFrom) where.printedAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.printedAt.lte = new Date(params.dateTo);
    }

    const orderBy: any = {};
    if (params.sort) {
      orderBy[params.sort] = params.order || 'desc';
    } else {
      orderBy.printedAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.printJob.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          client: { select: { id: true, name: true } },
          printer: { select: { id: true, name: true, model: true } },
        },
      }),
      this.prisma.printJob.count({ where }),
    ]);

    const summary = await this.getSummary(where);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary,
    };
  }

  private async getSummary(where: any) {
    const agg = await this.prisma.printJob.aggregate({
      where,
      _sum: { pages: true, colorPages: true, monoPages: true },
      _count: true,
    });

    return {
      totalPages: agg._sum.pages || 0,
      totalJobs: agg._count,
      colorPages: agg._sum.colorPages || 0,
      monoPages: agg._sum.monoPages || 0,
    };
  }

  async getStatsByUser(params: { clientId: string; dateFrom?: string; dateTo?: string; limit?: number }) {
    const where: any = { clientId: params.clientId };
    if (params.dateFrom || params.dateTo) {
      where.printedAt = {};
      if (params.dateFrom) where.printedAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.printedAt.lte = new Date(params.dateTo);
    }

    const results = await this.prisma.printJob.groupBy({
      by: ['username'],
      where,
      _sum: { pages: true, colorPages: true, monoPages: true },
      _count: true,
      orderBy: { _sum: { pages: 'desc' } },
      take: params.limit || 10,
    });

    return results.map((r) => ({
      username: r.username || 'unknown',
      totalPages: r._sum.pages || 0,
      colorPages: r._sum.colorPages || 0,
      monoPages: r._sum.monoPages || 0,
      totalJobs: r._count,
    }));
  }

  async getStatsByPrinter(params: { clientId: string; dateFrom?: string; dateTo?: string; limit?: number }) {
    const where: any = { clientId: params.clientId };
    if (params.dateFrom || params.dateTo) {
      where.printedAt = {};
      if (params.dateFrom) where.printedAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.printedAt.lte = new Date(params.dateTo);
    }

    const results = await this.prisma.printJob.groupBy({
      by: ['printerId'],
      where,
      _sum: { pages: true },
      _count: true,
      orderBy: { _sum: { pages: 'desc' } },
      take: params.limit || 10,
    });

    const printerIds = results.map((r) => r.printerId);
    const printers = await this.prisma.printer.findMany({
      where: { id: { in: printerIds } },
      select: { id: true, name: true, model: true },
    });
    const printerMap = new Map(printers.map((p) => [p.id, p]));

    return results.map((r) => {
      const printer = printerMap.get(r.printerId);
      return {
        printerId: r.printerId,
        printerName: printer?.name || 'Unknown',
        model: printer?.model || '',
        totalPages: r._sum.pages || 0,
        totalJobs: r._count,
      };
    });
  }

  async getDailyStats(params: { clientId: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { clientId: params.clientId };
    if (params.dateFrom || params.dateTo) {
      where.printedAt = {};
      if (params.dateFrom) where.printedAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.printedAt.lte = new Date(params.dateTo);
    }

    const jobs = await this.prisma.printJob.findMany({
      where,
      select: { pages: true, colorPages: true, printedAt: true },
      orderBy: { printedAt: 'asc' },
    });

    const dailyMap = new Map<string, { pages: number; colorPages: number; jobs: number; monoPages: number }>();

    for (const job of jobs) {
      if (!job.printedAt) continue;
      const day = job.printedAt.toISOString().split('T')[0];
      const existing = dailyMap.get(day) || { pages: 0, colorPages: 0, jobs: 0, monoPages: 0 };
      existing.pages += job.pages || 0;
      existing.colorPages += job.colorPages || 0;
      existing.monoPages += (job.pages || 0) - (job.colorPages || 0);
      existing.jobs++;
      dailyMap.set(day, existing);
    }

    return Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }
}
