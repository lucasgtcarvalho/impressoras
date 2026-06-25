import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PrintersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: string;
    search?: string;
    manufacturer?: string;
    agentId?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (params.clientId) where.clientId = params.clientId;
    if (params.status) where.status = params.status;
    if (params.manufacturer) where.manufacturer = params.manufacturer;
    if (params.agentId) where.agentId = params.agentId;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { ipAddress: { contains: params.search } },
        { model: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.printer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          supplyLevels: {
            orderBy: { collectedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              events: { where: { isResolved: false } },
            },
          },
        },
      }),
      this.prisma.printer.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const printer = await this.prisma.printer.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true, localIp: true } },
        supplyLevels: {
          orderBy: { collectedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!printer) throw new NotFoundException('Printer not found');
    return printer;
  }

  async update(id: string, data: { displayName?: string; location?: string; notes?: string }) {
    const printer = await this.prisma.printer.findUnique({ where: { id } });
    if (!printer) throw new NotFoundException('Printer not found');

    return this.prisma.printer.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const printer = await this.prisma.printer.findUnique({ where: { id } });
    if (!printer) throw new NotFoundException('Printer not found');

    await this.prisma.printer.update({
      where: { id },
      data: { isActive: false, status: 'offline' },
    });
  }

  async getStatusHistory(id: string, limit = 100) {
    return this.prisma.printerStatusHistory.findMany({
      where: { printerId: id },
      orderBy: { collectedAt: 'desc' },
      take: limit,
    });
  }

  async getCounterHistory(id: string, limit = 100) {
    return this.prisma.printerCounterHistory.findMany({
      where: { printerId: id },
      orderBy: { collectedAt: 'desc' },
      take: limit,
    });
  }

  async getSupplies(id: string) {
    return this.prisma.printerSupplyLevel.findMany({
      where: { printerId: id },
      orderBy: { collectedAt: 'desc' },
      distinct: ['supplyType'],
    });
  }

  async getEvents(id: string, params: { severity?: string; isResolved?: boolean; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { printerId: id };
    if (params.severity) where.severity = params.severity;
    if (params.isResolved !== undefined) where.isResolved = params.isResolved;

    const [data, total] = await Promise.all([
      this.prisma.printerEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.printerEvent.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
