import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { env } from '../config/env';

const SESSION_COOKIE = 'lawn_session';

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });

  constructor(private readonly prisma: PrismaService) {}

  sessionHash(token: string): string {
    return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');
  }

  csrfHash(token: string): string {
    return createHmac('sha256', env.CSRF_SECRET).update(token).digest('hex');
  }

  async login(identifierInput: string, password: string) {
    const identifier = identifierInput.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { active: true, OR: [{ email: identifier }, { username: identifier }] },
      include: { tenant: true },
    });
    const passwordHash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await argon2.verify(passwordHash, password);
    if (!user || !valid) throw new UnauthorizedException('Email/username atau kata sandi salah');

    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { userId: user.id, createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }] } });
      await tx.session.create({
        data: { userId: user.id, tokenHash: this.sessionHash(sessionToken), csrfHash: this.csrfHash(csrfToken), expiresAt },
      });
    });
    return {
      sessionToken,
      csrfToken,
      expiresAt,
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role },
      tenant: { id: user.tenant.id, businessName: user.tenant.businessName, phone: user.tenant.phone, address: user.tenant.address },
    };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: this.sessionHash(sessionToken) } });
  }

  async rotateCsrf(sessionId: string): Promise<string> {
    const csrfToken = randomBytes(32).toString('base64url');
    await this.prisma.session.update({ where: { id: sessionId }, data: { csrfHash: this.csrfHash(csrfToken) } });
    return csrfToken;
  }

  static readonly cookieName = SESSION_COOKIE;
}
