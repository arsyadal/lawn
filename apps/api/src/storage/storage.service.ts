import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OrderStatus, PhotoCategory, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import { RequestUploadDto } from './upload.dto';

const EXTENSION_BY_CONTENT_TYPE: Record<RequestUploadDto['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });

  constructor(private readonly prisma: PrismaService) {}

  async requestUpload(auth: AuthContext, input: RequestUploadDto) {
    if (auth.role === UserRole.STAFF && input.category !== PhotoCategory.AFTER) throw new ForbiddenException('Staff hanya dapat menambahkan foto hasil');
    const item = await this.prisma.orderItem.findFirst({
      where: { tenantId: auth.tenantId, id: input.orderItemId, orderId: input.orderId },
      select: { id: true, order: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item order tidak ditemukan');
    if (item.order.status === OrderStatus.COMPLETED || item.order.status === OrderStatus.CANCELLED) throw new BadRequestException('Foto tidak dapat ditambahkan ke order terminal');
    const objectKey = `${auth.tenantId}/orders/${input.orderId}/items/${input.orderItemId}/${randomUUID()}.${EXTENSION_BY_CONTENT_TYPE[input.contentType]}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const pending = await this.prisma.pendingUpload.create({
      data: {
        tenantId: auth.tenantId,
        orderId: input.orderId,
        orderItemId: item.id,
        createdById: auth.userId,
        category: input.category,
        objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresAt,
      },
    });
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, ContentType: input.contentType, ContentLength: input.sizeBytes }),
      { expiresIn: 600 },
    );
    return { uploadId: pending.id, uploadUrl, expiresAt, headers: { 'content-type': input.contentType } };
  }

  async confirmUpload(auth: AuthContext, uploadId: string) {
    const pending = await this.prisma.pendingUpload.findFirst({ where: { id: uploadId, tenantId: auth.tenantId } });
    if (!pending) throw new NotFoundException('Upload tidak ditemukan');
    if (pending.createdById !== auth.userId) throw new ForbiddenException('Upload hanya dapat dikonfirmasi oleh pembuatnya');
    if (pending.expiresAt <= new Date()) {
      await this.discardPending(pending.id, pending.objectKey);
      throw new BadRequestException('Upload telah kedaluwarsa');
    }
    let head;
    try {
      head = await this.client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: pending.objectKey }));
    } catch {
      throw new BadRequestException('Berkas belum berhasil diunggah');
    }
    if (head.ContentLength !== pending.sizeBytes || head.ContentType !== pending.contentType) {
      await this.discardPending(pending.id, pending.objectKey);
      throw new BadRequestException('Ukuran atau tipe berkas tidak sesuai permintaan upload');
    }
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.pendingUpload.deleteMany({ where: { id: pending.id, tenantId: auth.tenantId, createdById: auth.userId } });
      if (claimed.count !== 1) throw new BadRequestException('Upload sudah dikonfirmasi');
      return tx.itemPhoto.create({
        data: {
          tenantId: auth.tenantId,
          orderItemId: pending.orderItemId,
          createdById: auth.userId,
          category: pending.category,
          objectKey: pending.objectKey,
          contentType: pending.contentType,
          sizeBytes: pending.sizeBytes,
        },
        select: { id: true, orderItemId: true, category: true, contentType: true, sizeBytes: true, createdAt: true },
      });
    });
  }

  async signedDownload(tenantId: string, photoId: string) {
    const photo = await this.prisma.itemPhoto.findFirst({ where: { tenantId, id: photoId }, select: { objectKey: true, contentType: true } });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');
    const downloadUrl = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: photo.objectKey, ResponseContentType: photo.contentType }), { expiresIn: 60 });
    return { downloadUrl, expiresAt: new Date(Date.now() + 60_000) };
  }

  private async discardPending(id: string, objectKey: string): Promise<void> {
    await Promise.allSettled([
      this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey })),
      this.prisma.pendingUpload.deleteMany({ where: { id } }),
    ]);
  }
}
