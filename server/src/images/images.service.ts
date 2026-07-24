import { Injectable } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';

@Injectable()
export class ImagesService {
  private storage: S3Storage;

  constructor() {
    // 初始化对象存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }

  async uploadImage(file: Express.Multer.File) {
    // 生成文件名（带时间戳）
    const timestamp = Date.now();
    const fileName = `images/${timestamp}_${file.originalname}`;

    // 上传到对象存储
    const fileKey = await this.storage.uploadFile({
      fileContent: file.buffer,
      fileName: fileName,
      contentType: file.mimetype,
    });

    console.log('文件已上传到对象存储, key:', fileKey);

    // 生成可访问的 URL（有效期1天）
    const url = await this.storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400, // 1天
    });

    return {
      key: fileKey,
      url: url,
    };
  }
}