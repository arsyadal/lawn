import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { CurrentAuth, Public } from './auth.decorators';
import type { AuthContext } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { PrismaService } from '../database/prisma.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input.identifier, input.password);
    response.cookie(AuthService.cookieName, result.sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      expires: result.expiresAt,
    });
    const { sessionToken: _sessionToken, ...body } = result;
    return body;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.cookies?.[AuthService.cookieName]);
    response.clearCookie(AuthService.cookieName, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' });
  }

  @Get('csrf')
  async csrf(@CurrentAuth() context: AuthContext) {
    return { csrfToken: await this.auth.rotateCsrf(context.sessionId) };
  }

  @Get('me')
  async me(@CurrentAuth() context: AuthContext) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: context.userId, tenantId: context.tenantId, active: true },
      select: { id: true, email: true, username: true, displayName: true, role: true, tenant: { select: { id: true, businessName: true, phone: true, address: true } } },
    });
    return user;
  }
}
