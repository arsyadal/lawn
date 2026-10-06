import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { PHOTO_CATEGORIES } from '@lawn/contracts';

export class RequestUploadDto {
  @IsUUID() orderId!: string;
  @IsUUID() orderItemId!: string;
  @IsIn(PHOTO_CATEGORIES) category!: (typeof PHOTO_CATEGORIES)[number];
  @IsIn(['image/jpeg', 'image/png', 'image/webp']) contentType!: 'image/jpeg' | 'image/png' | 'image/webp';
  @IsInt() @Min(1) @Max(10 * 1024 * 1024) sizeBytes!: number;
}

export class ConfirmUploadDto {
  @IsUUID() uploadId!: string;
}
