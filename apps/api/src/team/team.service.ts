import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './team.dto';

const publicUserSelect = { id: true, email: true, username: true, displayName: true, role: true, active: true, createdAt: true, updatedAt: true } as const;

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({ where: { tenantId }, select: publicUserSelect, orderBy: [{ active: 'desc' }, { displayName: 'asc' }] });
  }

  async create(tenantId: string, input: CreateTeamMemberDto) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
    try {
      return await this.prisma.user.create({
        data: { tenantId, email, username, displayName: input.displayName.trim(), passwordHash, role: input.role },
        select: publicUserSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email atau username sudah digunakan');
      throw error;
    }
  }

  async update(auth: AuthContext, id: string, input: UpdateTeamMemberDto) {
    const user = await this.prisma.user.findFirst({ where: { tenantId: auth.tenantId, id }, select: { id: true, role: true, active: true } });
    if (!user) throw new NotFoundException('Anggota tim tidak ditemukan');
    if (id === auth.userId && (input.active === false || (input.role !== undefined && input.role !== UserRole.OWNER))) throw new BadRequestException('Owner tidak dapat menonaktifkan atau menurunkan role dirinya sendiri');
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.active === false ? { sessions: { deleteMany: {} } } : {}),
      },
      select: publicUserSelect,
    });
  }
}
