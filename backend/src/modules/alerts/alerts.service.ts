import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    clientId?: string;
    printerId?: string;
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.clientId) where.clientId = params.clientId;
    if (params.printerId) where.printerId = params.printerId;
    if (params.severity) where.severity = params.severity;
    if (params.status) where.status = params.status;
    if (params.dateFrom || params.dateTo) {
      where.occurredAt = {};
      if (params.dateFrom) where.occurredAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.occurredAt.lte = new Date(params.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          printer: { select: { id: true, name: true, ipAddress: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async acknowledge(id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.alert.update({
      where: { id },
      data: { status: 'acknowledged' },
    });
  }

  async resolve(id: string, userId: string, note?: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedById: userId,
        resolutionNote: note,
      },
    });
  }

  // Alert Rules
  async getRules(clientId: string) {
    return this.prisma.alertRule.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(clientId: string, data: {
    name: string;
    description?: string;
    metric: string;
    condition: any;
    severity: string;
    enabled?: boolean;
    notifyEmail?: boolean;
    notifyWebhook?: boolean;
    webhookUrl?: string;
    cooldownMinutes?: number;
  }) {
    return this.prisma.alertRule.create({
      data: {
        clientId,
        name: data.name,
        description: data.description,
        metric: data.metric,
        condition: data.condition,
        severity: data.severity as any,
        enabled: data.enabled ?? true,
        notifyEmail: data.notifyEmail ?? false,
        notifyWebhook: data.notifyWebhook ?? false,
        webhookUrl: data.webhookUrl,
        cooldownMinutes: data.cooldownMinutes ?? 60,
      },
    });
  }

  async updateRule(id: string, data: any) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.alertRule.update({
      where: { id },
      data,
    });
  }

  async deleteRule(id: string) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    await this.prisma.alertRule.delete({ where: { id } });
  }
}
