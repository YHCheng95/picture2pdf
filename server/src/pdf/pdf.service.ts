import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { S3Storage } from 'coze-coding-dev-sdk';
import fetch from 'node-fetch';

@Injectable()
export class PdfService {
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

  async generatePdf(imageUrls: string[], customFileName?: string) {
    // 创建 PDF 文档
    const pdfDoc = await PDFDocument.create();

    // 逐个添加图片
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`处理第 ${i + 1} 张图片:`, imageUrl);

      try {
        // 下载图片
        const imageBuffer = await this.downloadImage(imageUrl);

        // 判断图片格式并嵌入
        let image;
        if (imageUrl.toLowerCase().includes('.png')) {
          image = await pdfDoc.embedPng(imageBuffer);
        } else {
          // 默认当作 JPG 处理
          image = await pdfDoc.embedJpg(imageBuffer);
        }

        // 获取图片尺寸
        const { width: imgWidth, height: imgHeight } = image;

        // 计算页面尺寸（保持图片比例）
        // 使用 A4 尺寸作为基础 (595 x 842 点)
        const pageWidth = 595;
        const pageHeight = 842;

        // 计算缩放比例，确保图片完整显示且水平居中
        const scaleX = pageWidth / imgWidth;
        const scaleY = pageHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;

        // 添加页面
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // 计算居中位置
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;

        // 绘制图片（居中）
        page.drawImage(image, {
          x: x,
          y: y,
          width: scaledWidth,
          height: scaledHeight,
        });

        console.log(`第 ${i + 1} 张图片已添加到 PDF`);
      } catch (error) {
        console.error(`处理第 ${i + 1} 张图片失败:`, error);
        throw new Error(`处理第 ${i + 1} 张图片失败: ${error.message}`);
      }
    }

    // 生成 PDF 数据
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    console.log('PDF 生成完成, 大小:', pdfBuffer.length, 'bytes');

    // 上传 PDF 到对象存储
    const timestamp = Date.now();
    // 使用自定义文件名或自动生成
    let fileName: string;
    if (customFileName) {
      // 使用用户输入的文件名，过滤特殊字符
      const safeFileName = customFileName.replace(/[^\w\u4e00-\u9fa5-]/g, '_').substring(0, 50);
      fileName = `pdfs/${safeFileName}.pdf`;
    } else {
      // 自动生成文件名
      fileName = `pdfs/images_${timestamp}.pdf`;
    }

    const fileKey = await this.storage.uploadFile({
      fileContent: pdfBuffer,
      fileName: fileName,
      contentType: 'application/pdf',
    });

    console.log('PDF 已上传到对象存储, key:', fileKey);

    // 生成下载 URL（有效期1小时）
    const downloadUrl = await this.storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 3600, // 1小时
    });

    return {
      key: fileKey,
      downloadUrl: downloadUrl,
      pageCount: imageUrls.length,
    };
  }

  // 下载图片
  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}