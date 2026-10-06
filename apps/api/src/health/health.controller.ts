import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Public } from '../auth/auth.decorators';
import { env } from '../config/env';
import { PrismaService } from '../database/prisma.service';

@Controller()
export class HealthController {
  private readonly storage = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    try {
      await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.storage.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })),
      ]);
      return { status: 'ok', service: 'Lawn API' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', service: 'Lawn API' });
    }
  }
}
