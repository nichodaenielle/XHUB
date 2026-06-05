import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

@Injectable()
export class StorageService {
  private s3: S3;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      endpoint: this.configService.get('STORAGE_ENDPOINT'),
      accessKeyId: this.configService.get('STORAGE_ACCESS_KEY'),
      secretAccessKey: this.configService.get('STORAGE_SECRET_KEY'),
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.bucket = this.configService.get('STORAGE_BUCKET');
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
      .promise();

    const url = `${this.configService.get('STORAGE_ENDPOINT')}/${this.bucket}/${key}`;

    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: key,
      })
      .promise();
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    });
  }

  generateKey(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop();
    return `${userId}/${timestamp}-${randomString}.${extension}`;
  }

  async uploadAvatar(userId: string, buffer: Buffer, contentType: string): Promise<string> {
    const key = this.generateKey(userId, `avatar.${contentType.split('/')[1]}`);
    const { url } = await this.uploadFile(key, buffer, contentType);
    return url;
  }

  async uploadAttachment(
    userId: string,
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const key = this.generateKey(userId, fileName);
    return this.uploadFile(key, buffer, contentType);
  }

  async uploadAttachmentFile(file: any): Promise<{ url: string; thumbnailUrl?: string }> {
    const key = this.generateKey('attachment', file.originalname);
    const { url } = await this.uploadFile(key, file.buffer, file.mimetype);

    // Generate thumbnail for images
    let thumbnailUrl: string | undefined;
    if (file.mimetype.startsWith('image/')) {
      // For now, use the same URL as thumbnail
      // In production, you'd generate actual thumbnails
      thumbnailUrl = url;
    }

    return { url, thumbnailUrl };
  }
}
