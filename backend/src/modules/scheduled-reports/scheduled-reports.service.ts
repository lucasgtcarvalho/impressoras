import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { CreateScheduledReportDto } from './dto/create-scheduled-report.dto';
import { UpdateScheduledReportDto } from './dto/update-scheduled-report.dto';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER', ''),
        pass: this.config.get('SMTP_PASS', ''),
      },
    });
  }

  async create(dto: CreateScheduledReportDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.scheduledReport.create({
      data: {
        clientId: dto.clientId,
        name: dto.name,
        email: dto.email,
        dayOfMonth: dto.dayOfMonth,
        hour: dto.hour,
        minute: dto.minute,
      },
      include: { client: { select: { id: true, name: true } } },
    });
  }

  async findAll(clientId?: string) {
    const where: any = {};
    if (clientId) where.clientId = clientId;

    return this.prisma.scheduledReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!report) throw new NotFoundException('Scheduled report not found');
    return report;
  }

  async update(id: string, dto: UpdateScheduledReportDto) {
    const report = await this.prisma.scheduledReport.findFirst({ where: { id } });
    if (!report) throw new NotFoundException('Scheduled report not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.dayOfMonth !== undefined) data.dayOfMonth = dto.dayOfMonth;
    if (dto.hour !== undefined) data.hour = dto.hour;
    if (dto.minute !== undefined) data.minute = dto.minute;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.scheduledReport.update({
      where: { id },
      data,
      include: { client: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    const report = await this.prisma.scheduledReport.findFirst({ where: { id } });
    if (!report) throw new NotFoundException('Scheduled report not found');
    await this.prisma.scheduledReport.delete({ where: { id } });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndRunReports() {
    const now = new Date();
    const reports = await this.prisma.scheduledReport.findMany({
      where: { isActive: true },
      include: { client: true },
    });

    for (const report of reports) {
      if (this.isReportDue(report, now)) {
        try {
          await this.generateAndSendReport(report);
          await this.prisma.scheduledReport.update({
            where: { id: report.id },
            data: { lastRunAt: now },
          });
          this.logger.log(`Report "${report.name}" sent to ${report.email}`);
        } catch (err) {
          this.logger.error(`Failed to send report "${report.name}": ${err.message}`);
        }
      }
    }
  }

  private isReportDue(report: any, now: Date): boolean {
    if (report.dayOfMonth > 28) {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (now.getDate() !== Math.min(report.dayOfMonth, lastDay)) return false;
    } else {
      if (now.getDate() !== report.dayOfMonth) return false;
    }

    if (now.getHours() !== report.hour) return false;
    if (now.getMinutes() !== report.minute) return false;

    if (report.lastRunAt) {
      const lastRun = new Date(report.lastRunAt);
      if (lastRun.getDate() === now.getDate() &&
          lastRun.getMonth() === now.getMonth() &&
          lastRun.getFullYear() === now.getFullYear()) {
        return false;
      }
    }

    return true;
  }

  private async generateAndSendReport(report: any) {
    const printers = await this.prisma.printer.findMany({
      where: { clientId: report.clientId, isActive: true },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const printersData = [];
    for (const printer of printers) {
      const counters = await this.prisma.printerCounterHistory.findMany({
        where: {
          printerId: printer.id,
          collectedAt: { gte: thirtyDaysAgo },
        },
        orderBy: { collectedAt: 'asc' },
      });

      let pagesThisMonth = 0;
      if (counters.length >= 2) {
        const first = counters[0];
        const last = counters[counters.length - 1];
        pagesThisMonth = Math.max(0, Number(last.totalPages) - Number(first.totalPages));
      }

      printersData.push({
        name: printer.name,
        model: printer.model || '-',
        serial: printer.serialNumber || '-',
        ip: printer.ipAddress,
        totalPages: Number(printer.totalPages || 0),
        pagesThisMonth,
        lastCounterAt: counters.length > 0 ? counters[counters.length - 1].collectedAt : null,
      });
    }

    const xml = this.generateXML(report.client.name, printersData, now);
    await this.sendEmail(report.email, report.client.name, xml, now);
  }

  private generateXML(clientName: string, printers: any[], date: Date): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<RelatorioContadores>\n';
    xml += `  <Cabecalho>\n`;
    xml += `    <Cliente>${this.escapeXml(clientName)}</Cliente>\n`;
    xml += `    <DataGeracao>${date.toISOString()}</DataGeracao>\n`;
    xml += `    <Periodo>Ultimos 30 dias</Periodo>\n`;
    xml += `  </Cabecalho>\n`;
    xml += `  <Impressoras>\n`;

    for (const p of printers) {
      xml += `    <Impressora>\n`;
      xml += `      <Nome>${this.escapeXml(p.name)}</Nome>\n`;
      xml += `      <Modelo>${this.escapeXml(p.model)}</Modelo>\n`;
      xml += `      <Serial>${this.escapeXml(p.serial)}</Serial>\n`;
      xml += `      <IP>${p.ip}</IP>\n`;
      xml += `      <ContadorTotal>${p.totalPages}</ContadorTotal>\n`;
      xml += `      <PaginasPeriodo>${p.pagesThisMonth}</PaginasPeriodo>\n`;
      xml += `      <UltimoContador>${p.lastCounterAt || 'N/A'}</UltimoContador>\n`;
      xml += `    </Impressora>\n`;
    }

    xml += `  </Impressoras>\n`;
    xml += `  <Resumo>\n`;
    xml += `    <TotalImpressoras>${printers.length}</TotalImpressoras>\n`;
    xml += `    <TotalPaginasPeriodo>${printers.reduce((s, p) => s + p.pagesThisMonth, 0)}</TotalPaginasPeriodo>\n`;
    xml += `  </Resumo>\n`;
    xml += '</RelatorioContadores>';

    return xml;
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private async sendEmail(to: string, clientName: string, xml: string, date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    const filename = `contadores_${clientName.replace(/\s+/g, '_')}_${dateStr}.xml`;

    await this.transporter.sendMail({
      from: this.config.get('SMTP_FROM', 'noreply@cloudspool.com.br'),
      to,
      subject: `Relatorio de Contadores - ${clientName} - ${dateStr}`,
      text: `Segue em anexo o relatorio de contadores mensal da empresa ${clientName}.`,
      attachments: [{
        filename,
        content: xml,
        contentType: 'application/xml',
      }],
    });
  }
}
