import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { ImagesModule } from './images/images.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [ImagesModule, PdfModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}