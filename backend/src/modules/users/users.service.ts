import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LinkClientDto } from './dto/link-client.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone,
        role: dto.role,
      },
    });

    if (dto.clientIds?.length) {
      await this.prisma.userClientLink.createMany({
        data: dto.clientIds.map((clientId) => ({
          userId: user.id,
          clientId,
          role: 'operator',
        })),
      });
    }

    return this.findById(user.id);
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.role) where.role = params.role;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          clientLinks: {
            select: { client: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        clientLinks: {
          include: { client: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.phone) data.phone = dto.phone;
    if (dto.role) data.role = dto.role;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.user.update({ where: { id }, data });
    return this.findById(id);
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, refreshToken: null },
    });
  }

  async linkClient(userId: string, dto: LinkClientDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const existing = await this.prisma.userClientLink.findUnique({
      where: { userId_clientId: { userId, clientId: dto.clientId } },
    });

    if (existing) throw new ConflictException('User already linked to this client');

    await this.prisma.userClientLink.create({
      data: { userId, clientId: dto.clientId, role: dto.role },
    });

    return this.findById(userId);
  }

  async unlinkClient(userId: string, clientId: string) {
    const link = await this.prisma.userClientLink.findUnique({
      where: { userId_clientId: { userId, clientId } },
    });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.userClientLink.delete({
      where: { userId_clientId: { userId, clientId } },
    });
  }

  async updateLinkRole(userId: string, clientId: string, role: string) {
    const link = await this.prisma.userClientLink.findUnique({
      where: { userId_clientId: { userId, clientId } },
    });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.userClientLink.update({
      where: { userId_clientId: { userId, clientId } },
      data: { role: role as any },
    });
  }
}
