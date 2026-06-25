import { PrismaClient, UserRole, ClientStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@impressora.io' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@impressora.io',
      passwordHash: adminPassword,
      role: UserRole.super_admin,
      isActive: true,
    },
  });

  console.log(`Admin created: ${admin.email}`);

  const client1 = await prisma.client.upsert({
    where: { activationCode: 'demo-abc-123456' },
    update: {},
    create: {
      name: 'Empresa Demo',
      legalName: 'Empresa Demo Ltda',
      document: '11.111.111/0001-11',
      email: 'demo@empresa.com',
      status: ClientStatus.active,
      activationCode: 'demo-abc-123456',
      settings: {
        create: {
          collectionIntervalSeconds: 300,
          dataRetentionDays: 365,
          alertOfflineMinutes: 10,
          alertTonerLowThreshold: 20,
          costPerPageMono: 0.10,
          costPerPageColor: 0.50,
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
        },
      },
    },
  });

  console.log(`Client created: ${client1.name}`);

  await prisma.userClientLink.upsert({
    where: { userId_clientId: { userId: admin.id, clientId: client1.id } },
    update: {},
    create: {
      userId: admin.id,
      clientId: client1.id,
      role: UserRole.client_manager,
    },
  });

  console.log('Admin linked to client');

  const agent = await prisma.agent.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      clientId: client1.id,
      name: 'AGENTE-DEMO-01',
      agentVersion: '1.0.0',
      osInfo: 'Windows 11 Pro',
      localIp: '192.168.1.100',
      macAddress: '00:1A:2B:3C:4D:5E',
      status: 'online',
      lastContactAt: new Date(),
      config: { snmpCommunity: 'public', snmpVersion: 'v2c' },
    },
  });

  console.log(`Agent created: ${agent.name}`);

  const printer = await prisma.printer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      clientId: client1.id,
      agentId: agent.id,
      name: 'HP LaserJet M404dn',
      ipAddress: '192.168.1.10',
      hostname: 'HP-LASERJET-01',
      macAddress: '00:1A:2B:3C:4D:5F',
      manufacturer: 'HP',
      model: 'LaserJet M404dn',
      serialNumber: 'VNB3C12345',
      location: 'Sala 201',
      status: 'online',
      statusDetail: 'idle',
      totalPages: BigInt(125000),
      isMonochrome: true,
      firstSeenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lastContactAt: new Date(),
    },
  });

  console.log(`Printer created: ${printer.name}`);

  await prisma.printerSupplyLevel.create({
    data: {
      printerId: printer.id,
      clientId: client1.id,
      supplyType: 'toner_black',
      supplyName: 'HP 58A',
      levelPercent: 65,
      status: 'ok',
      collectedAt: new Date(),
    },
  });

  await prisma.printerCounterHistory.create({
    data: {
      printerId: printer.id,
      clientId: client1.id,
      totalPages: BigInt(125000),
      monoPages: BigInt(120000),
      colorPages: BigInt(0),
      collectedAt: new Date(),
    },
  });

  console.log('Sample data created');
  console.log('Login: admin@impressora.io / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
