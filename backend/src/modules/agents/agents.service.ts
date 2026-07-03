import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { ActivateAgentDto } from './dto/activate-agent.dto';
import { SyncPayloadDto } from './dto/sync-payload.dto';
import { sanitizeUsername } from '../../common/utils/helpers';

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async activate(dto: ActivateAgentDto) {
    const client = await this.prisma.client.findFirst({
      where: {
        activationCode: dto.activationCode,
        status: 'active',
        deletedAt: null,
      },
    });

    if (!client) throw new UnauthorizedException('Invalid activation code');

    const existingAgent = await this.prisma.agent.findFirst({
      where: {
        clientId: client.id,
        name: dto.hostname,
        isActive: true,
      },
    });

    if (existingAgent) {
      const token = await this.generateAgentToken(existingAgent.id, client.id);
      await this.prisma.agent.update({
        where: { id: existingAgent.id },
        data: {
          tokenHash: await bcrypt.hash(token, 10),
          tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          osInfo: dto.osInfo,
          localIp: dto.localIp,
          macAddress: dto.macAddress,
          agentVersion: dto.version,
          lastContactAt: new Date(),
        },
      });

      return {
        agentId: existingAgent.id,
        agentToken: token,
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        config: {
          collectionIntervalSeconds: 300,
          snmpCommunity: 'public',
          snmpVersion: 'v2c',
        },
      };
    }

    const agentCount = await this.prisma.agent.count({
      where: { clientId: client.id, isActive: true },
    });

    if (agentCount >= client.maxAgents) {
      throw new ConflictException('Maximum number of agents reached for this client');
    }

    const agent = await this.prisma.agent.create({
      data: {
        clientId: client.id,
        name: dto.hostname,
        agentVersion: dto.version,
        osInfo: dto.osInfo,
        localIp: dto.localIp,
        macAddress: dto.macAddress,
        status: 'online',
        lastContactAt: new Date(),
        config: {
          snmpCommunity: 'public',
          snmpVersion: 'v2c',
          scanRange: null,
        },
      },
    });

    const token = await this.generateAgentToken(agent.id, client.id);
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        tokenHash: await bcrypt.hash(token, 10),
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      agentId: agent.id,
      agentToken: token,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      config: {
        collectionIntervalSeconds: 300,
        snmpCommunity: 'public',
        snmpVersion: 'v2c',
      },
    };
  }

  async heartbeat(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        lastContactAt: new Date(),
        status: 'online',
      },
    });
  }

  async sync(agentId: string, dto: SyncPayloadDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { client: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const clientId = agent.clientId;
    const now = new Date();
    const results = {
      printers: 0,
      counters: 0,
      supplies: 0,
      events: 0,
      jobs: 0,
    };

    if (dto.printers?.length) {
      for (const p of dto.printers) {
        const matchConditions: any[] = [];
        if (p.serialNumber) matchConditions.push({ serialNumber: p.serialNumber });
        if (p.ipAddress) matchConditions.push({ ipAddress: p.ipAddress });

        const existing = matchConditions.length > 0
          ? await this.prisma.printer.findFirst({
              where: { clientId, OR: matchConditions },
            })
          : null;

        const hasModel = p.model && p.model.trim() !== '';
        const printerData: any = {
          clientId,
          agentId,
          isActive: hasModel,
          name: p.name || p.hostname || p.ipAddress,
          ipAddress: p.ipAddress,
          hostname: p.hostname,
          macAddress: p.macAddress,
          location: p.location,
          firmwareVersion: p.firmwareVersion,
          status: ((p.status && ['online', 'offline', 'error', 'warning'].includes(p.status)) ? p.status : 'online') as any,
          statusDetail: p.statusDetail,
          uptimeSeconds: p.uptimeSeconds ? BigInt(p.uptimeSeconds) : null,
          isMonochrome: p.isMonochrome,
          lastContactAt: now,
          discoveryMethod: 'snmp',
        };
        if (p.manufacturer) printerData.manufacturer = p.manufacturer;
        if (p.model) printerData.model = p.model;
        if (p.serialNumber) printerData.serialNumber = p.serialNumber;

        if (existing) {
          await this.prisma.printer.update({
            where: { id: existing.id },
            data: printerData,
          });
        } else {
          await this.prisma.printer.create({
            data: {
              ...printerData,
              totalPages: BigInt(0),
              firstSeenAt: now,
            },
          });
        }
        results.printers++;
      }
    }

    if (dto.counters?.length) {
      for (const c of dto.counters) {
        const printer = await this.prisma.printer.findFirst({
          where: { clientId, ipAddress: c.printerIp },
        });
        if (!printer) continue;

        await this.prisma.printerCounterHistory.create({
          data: {
            printerId: printer.id,
            clientId,
            totalPages: c.totalPages ? BigInt(c.totalPages) : null,
            monoPages: c.monoPages ? BigInt(c.monoPages) : null,
            colorPages: c.colorPages ? BigInt(c.colorPages) : null,
            copyPages: c.copyPages ? BigInt(c.copyPages) : null,
            scanPages: c.scanPages ? BigInt(c.scanPages) : null,
            duplexPages: c.duplexPages ? BigInt(c.duplexPages) : null,
            collectedAt: c.collectedAt ? new Date(c.collectedAt) : now,
          },
        });

        if (c.totalPages) {
          await this.prisma.printer.update({
            where: { id: printer.id },
            data: { totalPages: BigInt(c.totalPages), lastContactAt: now },
          });
        }
        results.counters++;
      }
    }

    if (dto.supplies?.length) {
      console.log(`[DEBUG] supplies count: ${dto.supplies.length}`);
      for (const s of dto.supplies) {
        console.log(`[DEBUG] supply ip=${s.printerIp}, supplies=${JSON.stringify(s.supplies)}`);
        const printer = await this.prisma.printer.findFirst({
          where: { clientId, ipAddress: s.printerIp },
        });
        if (!printer) { console.log(`[DEBUG] printer not found for ${s.printerIp}`); continue; }

        for (const supply of s.supplies) {
          await this.prisma.printerSupplyLevel.create({
            data: {
              printerId: printer.id,
              clientId,
              supplyType: supply.type,
              supplyName: supply.name,
              levelPercent: supply.levelPercent,
              levelRemaining: supply.levelRemaining,
              maxCapacity: supply.maxCapacity,
              status: supply.status || 'unknown',
              collectedAt: now,
            },
          });

          if (supply.levelPercent !== undefined && supply.levelPercent <= 20) {
            const existingAlert = await this.prisma.alert.findFirst({
              where: {
                clientId,
                printerId: printer.id,
                status: 'open',
                eventType: 'toner_low',
              },
            });
            if (!existingAlert) {
              await this.prisma.alert.create({
                data: {
                  clientId,
                  printerId: printer.id,
                  title: `Toner baixo: ${printer.name}`,
                  description: `Toner ${supply.type} em ${supply.levelPercent}%`,
                  severity: 'warning',
                  status: 'open',
                  source: 'agent',
                  occurredAt: now,
                },
              });
            }
          }
        }
        results.supplies++;
      }
    }

    if (dto.events?.length) {
      for (const e of dto.events) {
        const printer = await this.prisma.printer.findFirst({
          where: { clientId, ipAddress: e.printerIp },
        });
        if (!printer) continue;

        await this.prisma.printerEvent.create({
          data: {
            printerId: printer.id,
            clientId,
            eventType: e.eventType,
            severity: (e.severity as any) || 'warning',
            code: e.code,
            description: e.description,
            occurredAt: e.occurredAt ? new Date(e.occurredAt) : now,
          },
        });

        if (['offline', 'toner_empty', 'error', 'paper_jam', 'paper_empty', 'door_open', 'printer_offline', 'service_required'].includes(e.eventType)) {
          await this.prisma.printer.update({
            where: { id: printer.id },
            data: { status: e.eventType === 'printer_offline' ? 'offline' : 'error', statusDetail: e.eventType, lastContactAt: now },
          });
        }

        // Create alert for critical hardware events
        const alertEventTypes = ['paper_jam', 'paper_empty', 'door_open', 'toner_empty', 'service_required'];
        if (alertEventTypes.includes(e.eventType)) {
          const existingAlert = await this.prisma.alert.findFirst({
            where: {
              clientId,
              printerId: printer.id,
              status: 'open',
              eventType: e.eventType,
            },
          });
          if (!existingAlert) {
            const alertTitles: Record<string, string> = {
              paper_jam: `Papel atolado: ${printer.name}`,
              paper_empty: `Sem papel: ${printer.name}`,
              door_open: `Porta aberta: ${printer.name}`,
              toner_empty: `Toner vazio: ${printer.name}`,
              service_required: `Servico necessario: ${printer.name}`,
            };
            await this.prisma.alert.create({
              data: {
                clientId,
                printerId: printer.id,
                title: alertTitles[e.eventType] || `Evento: ${printer.name}`,
                description: e.description,
                eventType: e.eventType,
                severity: (e.severity as any) || 'warning',
                status: 'open',
                source: 'agent',
                occurredAt: now,
              },
            });
          }
        }

        results.events++;
      }
    }

    if (dto.jobs?.length) {
      for (const j of dto.jobs) {
        const printer = await this.prisma.printer.findFirst({
          where: { clientId, ipAddress: j.printerIp },
        });
        if (!printer) continue;

        const printedAt = j.printedAt ? new Date(j.printedAt) : now;

        const existing = await this.prisma.printJob.findFirst({
          where: {
            printerId: printer.id,
            jobId: j.jobId,
            printedAt,
          },
        });

        if (!existing) {
          await this.prisma.printJob.create({
            data: {
              clientId,
              printerId: printer.id,
              agentId,
              jobId: j.jobId,
              documentName: j.documentName,
              documentType: j.documentType,
              pages: j.pages,
              copies: j.copies || 1,
              colorPages: j.colorPages,
              monoPages: j.monoPages,
              isDuplex: j.isDuplex,
              username: sanitizeUsername(j.username || 'unknown'),
              computerName: j.computerName,
              jobStatus: (j.jobStatus as any) || 'completed',
              jobSizeBytes: j.jobSizeBytes ? BigInt(j.jobSizeBytes) : null,
              printedAt,
              collectedAt: now,
            },
          });
          results.jobs++;
        }
      }
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { lastSyncAt: now, lastContactAt: now, status: 'online' },
    });

    return {
      accepted: true,
      processedItems: results,
      serverTime: now.toISOString(),
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (params.clientId) where.clientId = params.clientId;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { printers: true } },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        printers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            ipAddress: true,
            model: true,
            status: true,
            lastContactAt: true,
          },
        },
        syncLogs: {
          orderBy: { syncedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async remove(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent not found');

    await this.prisma.agent.update({
      where: { id },
      data: { isActive: false, status: 'offline' },
    });
  }

  private async generateAgentToken(agentId: string, clientId: string) {
    return this.jwtService.signAsync(
      { sub: agentId, clientId, type: 'agent' },
      {
        secret: process.env.JWT_SECRET || 'dev-secret',
        expiresIn: '30d',
      },
    );
  }
}
