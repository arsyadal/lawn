import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, input: CreateServiceDto) {
    try {
      return await this.prisma.service.create({ data: { tenantId, name: input.name.trim(), description: input.description?.trim(), price: input.price, estimatedMinutes: input.estimatedMinutes } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Nama layanan sudah digunakan');
      throw error;
    }
  }

  list(tenantId: string, includeInactive: boolean) {
    return this.prisma.service.findMany({ where: { tenantId, ...(includeInactive ? {} : { active: true }) }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  }

  async detail(tenantId: string, id: string) {
    const service = await this.prisma.service.findFirst({ where: { tenantId, id } });
    if (!service) throw new NotFoundException('Layanan tidak ditemukan');
    return service;
  }

  async update(tenantId: string, id: string, input: UpdateServiceDto) {
    await this.detail(tenantId, id);
    try {
      return await this.prisma.service.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.price !== undefined ? { price: input.price } : {}),
          ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Nama layanan sudah digunakan');
      throw error;
    }
  }

  async deactivate(tenantId: string, id: string) {
    await this.detail(tenantId, id);
    return this.prisma.service.update({ where: { id }, data: { active: false } });
  }
}
