import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';
import { memoryStorage } from 'multer';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // 只允许图片格式
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('只允许上传图片文件'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择图片文件');
    }

    console.log('上传图片:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    try {
      const result = await this.imagesService.uploadImage(file);
      return {
        code: 200,
        msg: 'success',
        data: result,
      };
    } catch (error) {
      console.error('图片上传失败:', error);
      throw new BadRequestException('图片上传失败: ' + error.message);
    }
  }
}