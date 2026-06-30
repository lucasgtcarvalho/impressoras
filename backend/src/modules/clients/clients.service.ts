import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientSettingsDto } from './dto/update-client-settings.dto';
import { generateActivationCode } from '../../common/utils/helpers';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    const activationCode = generateActivationCode();

    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        legalName: dto.legalName,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        address: dto.address || undefined,
        status: dto.status || 'active',
        notes: dto.notes,
        activationCode,
        settings: {
          create: {},
        },
      },
      include: {
        settings: true,
      },
    });

    return client;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { document: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.status) where.status = params.status;

    if (params.userId) {
      where.userLinks = { some: { userId: params.userId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          legalName: true,
          document: true,
          email: true,
          status: true,
          activationCode: true,
          createdAt: true,
          _count: {
            select: {
              agents: { where: { isActive: true } },
              printers: { where: { isActive: true } },
              alerts: { where: { status: 'open' } },
            },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const mapped = data.map((c) => ({
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      document: c.document,
      email: c.email,
      status: c.status,
      activationCode: c.activationCode,
      createdAt: c.createdAt,
      agentsCount: c._count.agents,
      printersCount: c._count.printers,
      openAlertsCount: c._count.alerts,
    }));

    return {
      data: mapped,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: true,
        _count: {
          select: {
            agents: true,
            printers: true,
            alerts: { where: { status: 'open' } },
            printJobs: true,
          },
        },
      },
    });

    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        status: dto.status,
        notes: dto.notes,
      },
      include: { settings: true },
    });
  }

  async remove(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'inactive' },
    });
  }

  async regenerateToken(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    const activationCode = generateActivationCode();

    await this.prisma.client.update({
      where: { id },
      data: { activationCode },
    });

    return { activationCode };
  }

  async getStats(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPrinters,
      onlinePrinters,
      errorPrinters,
      activeAgents,
      totalJobsThisMonth,
      totalPagesThisMonth,
      openAlerts,
    ] = await Promise.all([
      this.prisma.printer.count({ where: { clientId: id, isActive: true } }),
      this.prisma.printer.count({
        where: { clientId: id, isActive: true, lastContactAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      }),
      this.prisma.printer.count({
        where: { clientId: id, isActive: true, status: 'error' },
      }),
      this.prisma.agent.count({
        where: { clientId: id, isActive: true, status: 'online' },
      }),
      this.prisma.printJob.count({
        where: { clientId: id, printedAt: { gte: firstOfMonth } },
      }),
      this.prisma.printJob.aggregate({
        where: { clientId: id, printedAt: { gte: firstOfMonth } },
        _sum: { pages: true },
      }),
      this.prisma.alert.count({
        where: { clientId: id, status: 'open' },
      }),
    ]);

    return {
      totalPrinters,
      onlinePrinters,
      errorPrinters,
      offlinePrinters: totalPrinters - onlinePrinters - errorPrinters,
      activeAgents,
      totalJobsThisMonth,
      totalPagesThisMonth: totalPagesThisMonth._sum.pages || 0,
      openAlerts,
    };
  }

  async updateSettings(id: string, dto: UpdateClientSettingsDto) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    const data: any = {};
    if (dto.collectionIntervalSeconds !== undefined)
      data.collectionIntervalSeconds = dto.collectionIntervalSeconds;
    if (dto.dataRetentionDays !== undefined)
      data.dataRetentionDays = dto.dataRetentionDays;
    if (dto.alertOfflineMinutes !== undefined)
      data.alertOfflineMinutes = dto.alertOfflineMinutes;
    if (dto.alertTonerLowThreshold !== undefined)
      data.alertTonerLowThreshold = dto.alertTonerLowThreshold;
    if (dto.costPerPageMono !== undefined)
      data.costPerPageMono = dto.costPerPageMono;
    if (dto.costPerPageColor !== undefined)
      data.costPerPageColor = dto.costPerPageColor;
    if (dto.currency) data.currency = dto.currency;
    if (dto.timezone) data.timezone = dto.timezone;

    return this.prisma.clientSetting.upsert({
      where: { clientId: id },
      update: data,
      create: { clientId: id, ...data },
    });
  }
}
