import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentAuth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { StorageService } from './storage.service';
import { ConfirmUploadDto, RequestUploadDto } from './upload.dto';

@Controller('api')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('uploads')
  requestUpload(@CurrentAuth() auth: AuthContext, @Body() input: RequestUploadDto) {
    return this.storage.requestUpload(auth, input);
  }

  @Post('uploads/confirm')
  confirmUpload(@CurrentAuth() auth: AuthContext, @Body() input: ConfirmUploadDto) {
    return this.storage.confirmUpload(auth, input.uploadId);
  }

  @Get('photos/:id/download')
  signedDownload(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.storage.signedDownload(auth.tenantId, id);
  }
}
