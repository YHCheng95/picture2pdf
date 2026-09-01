import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { PdfService } from './pdf.service';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('generate')
  @HttpCode(200)
  async generatePdf(@Body() body: { images: string[]; fileName?: string }) {
    const { images, fileName } = body;

    if (!images || images.length === 0) {
      throw new BadRequestException('请提供图片列表');
    }

    console.log('生成PDF, 图片数量:', images.length, '文件名:', fileName);

    try {
      const result = await this.pdfService.generatePdf(images, fileName);
      return {
        code: 200,
        msg: 'success',
        data: result,
      };
    } catch (error) {
      console.error('PDF生成失败:', error);
      throw new BadRequestException('PDF生成失败: ' + error.message);
    }
  }
}