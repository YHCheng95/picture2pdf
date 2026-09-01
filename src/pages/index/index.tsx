import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { PDFDocument, PageSizes } from 'pdf-lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, FileDown } from 'lucide-react-taro';

/**
 * 图片转 PDF 工具首页 - 纯本地版本
 */
const IndexPage = () => {
  const [images, setImages] = useState<{ path: string; fileName: string }[]>([]);
  const [converting, setConverting] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

  // 选择图片
  const handleChooseImage = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      const newImages: { path: string; fileName: string }[] = [];

      // 检测平台
      const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

      console.log('平台检测:', isH5 ? 'H5' : '小程序');
      console.log('选择的图片:', res);

      for (let i = 0; i < res.tempFilePaths.length; i++) {
        const filePath = res.tempFilePaths[i];
        let fileName = `图片${i + 1}`;

        if (isH5) {
          // H5 端：从 File 对象获取文件名
          const file = res.tempFiles?.[i];
          if (file) {
            const fileObj = (file as any).originalFileObj || file;
            if (fileObj && fileObj.name) {
              fileName = fileObj.name;
            }
          }
        } else {
          // 小程序端：从路径提取文件名
          const fileNameMatch = filePath.match(/[^/\\]+$/);
          if (fileNameMatch) {
            fileName = fileNameMatch[0];
          }
        }

        newImages.push({ path: filePath, fileName });
      }

      // 更新图片列表
      setImages([...images, ...newImages]);
      Taro.showToast({
        title: `已添加 ${newImages.length} 张图片`,
        icon: 'success',
      });
    } catch (err) {
      console.error('选择图片失败:', err);
      Taro.showToast({
        title: '选择图片失败',
        icon: 'none',
      });
    }
  };

  // 删除图片
  const handleDeleteImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  // 将图片转换为 ArrayBuffer
  const imageToBytes = async (imagePath: string): Promise<Uint8Array> => {
    const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

    if (isH5) {
      // H5 端：使用 fetch 读取本地文件
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } else {
      // 小程序端：使用 Taro.getFileSystemManager
      return new Promise((resolve, reject) => {
        Taro.getFileSystemManager().readFile({
          filePath: imagePath,
          success: (res) => {
            const data = res.data;
            if (typeof data === 'string') {
              // 如果是字符串，转换为 Uint8Array
              const encoder = new TextEncoder();
              resolve(new Uint8Array(encoder.encode(data)));
            } else {
              resolve(new Uint8Array(data as ArrayBuffer));
            }
          },
          fail: (err) => {
            reject(err);
          },
        });
      });
    }
  };

  // 转换并保存 PDF（纯本地）
  const handleConvertToPdf = async () => {
    if (images.length === 0) {
      Taro.showToast({
        title: '请先添加图片',
        icon: 'none',
      });
      return;
    }

    try {
      setConverting(true);
      Taro.showLoading({ title: '正在生成PDF...' });

      // 创建 PDF 文档
      const pdfDoc = await PDFDocument.create();

      // 逐张图片处理
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        Taro.showLoading({ title: `处理第 ${i + 1}/${images.length} 张图片...` });

        try {
          // 读取图片数据
          const imageBytes = await imageToBytes(image.path);

          // 根据文件扩展名判断图片类型
          const isPng = image.fileName.toLowerCase().endsWith('.png');
          
          // 嵌入图片到 PDF
          let embeddedImage;
          if (isPng) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }

          // 获取图片尺寸
          const imgWidth = embeddedImage.width;
          const imgHeight = embeddedImage.height;

          // 使用 A4 页面尺寸
          const [pageWidth, pageHeight] = PageSizes.A4;

          // 添加新页面
          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          // 计算缩放比例，使图片完整显示在页面内
          const scaleX = pageWidth / imgWidth;
          const scaleY = pageHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY) * 0.9; // 留出 10% 边距

          const scaledWidth = imgWidth * scale;
          const scaledHeight = imgHeight * scale;

          // 计算居中位置
          const x = (pageWidth - scaledWidth) / 2;
          const y = (pageHeight - scaledHeight) / 2;

          // 绘制图片
          page.drawImage(embeddedImage, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });
        } catch (err) {
          console.error(`处理第 ${i + 1} 张图片失败:`, err);
          Taro.showToast({
            title: `第 ${i + 1} 张图片处理失败`,
            icon: 'none',
          });
        }
      }

      // 保存 PDF
      Taro.showLoading({ title: '正在保存PDF...' });
      const pdfBytes = await pdfDoc.save();

      // 检测平台
      const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

      if (isH5) {
        // H5 端：使用 blob 下载
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        
        // 使用用户输入的文件名或自动生成
        const downloadFileName = pdfFileName
          ? `${pdfFileName.replace(/[^\w\u4e00-\u9fa5-]/g, '_')}.pdf`
          : `images_${Date.now()}.pdf`;
        link.download = downloadFileName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

        Taro.showToast({
          title: 'PDF已保存',
          icon: 'success',
        });
      } else {
        // 小程序端：保存到临时文件
        const filePath = `${Taro.env.USER_DATA_PATH}/${pdfFileName || `images_${Date.now()}`}.pdf`;
        
        await new Promise<void>((resolve, reject) => {
          Taro.getFileSystemManager().writeFile({
            filePath,
            data: pdfBytes.buffer as ArrayBuffer,
            encoding: 'binary',
            success: () => resolve(),
            fail: (err) => reject(err),
          });
        });

        // 打开 PDF 文档
        await Taro.openDocument({
          filePath,
          fileType: 'pdf',
          showMenu: true, // 显示菜单，可以分享、保存等
        });

        Taro.showToast({
          title: 'PDF已生成',
          icon: 'success',
        });
      }
    } catch (err) {
      console.error('PDF转换失败:', err);
      Taro.showToast({
        title: 'PDF转换失败',
        icon: 'none',
      });
    } finally {
      setConverting(false);
      Taro.hideLoading();
    }
  };

  return (
    <View className="w-full h-full bg-neutral-50 flex flex-col">
      {/* 内容区域 */}
      <View className="flex-1 flex flex-col px-4 py-6 overflow-hidden">
        {/* 已选图片列表 - 始终显示，占据剩余空间 */}
        <Card className="flex-1 mb-4 overflow-hidden">
          <CardContent className="p-4 h-full flex flex-col">
            <Text className="block text-lg font-semibold text-neutral-900 mb-4">
              已选图片（{images.length}张）
            </Text>

            {/* 可滚动的图片列表 */}
            <View className="flex-1 overflow-hidden relative">
              {images.length > 0 ? (
                <ScrollView scrollY className="h-full">
                  <View className="flex flex-col gap-3 pb-4">
                    {images.map((image, index) => (
                      <View
                        key={index}
                        className="flex flex-row items-center gap-3 bg-neutral-50 rounded-lg p-3"
                      >
                        {/* 序号 */}
                        <View className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <Text className="text-white text-sm font-medium">
                            {index + 1}
                          </Text>
                        </View>

                        {/* 缩略图 */}
                        <Image
                          src={image.path}
                          className="w-16 h-16 rounded-lg object-cover"
                          mode="aspectFill"
                        />

                        {/* 图片信息 - 固定宽度 */}
                        <View className="w-32 flex flex-col min-w-0">
                          <Text className="block text-sm font-medium text-neutral-900 truncate">
                            {image.fileName}
                          </Text>
                          <Text className="block text-xs text-neutral-500 mt-1 truncate">
                            点击删除按钮可移除
                          </Text>
                        </View>

                        {/* 删除按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteImage(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 size={20} color="#ef4444" />
                        </Button>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                /* 空状态提示 */
                <View className="absolute inset-0 flex items-center justify-center">
                  <Text className="block text-base text-neutral-500 text-center">
                    点击下方按钮添加图片
                  </Text>
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 底部固定区域 */}
        <View className="flex flex-col gap-4">
          {/* PDF 文件名输入框 */}
          <Card>
            <CardContent className="p-4">
              <Text className="block text-sm font-medium text-neutral-700 mb-2">
                PDF 文件名（可选）
              </Text>
              <View className="bg-neutral-50 rounded-lg px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="请输入 PDF 文件名（不填则自动生成）"
                  value={pdfFileName}
                  onInput={(e) => setPdfFileName(e.detail.value)}
                />
              </View>
            </CardContent>
          </Card>

          {/* 添加图片按钮 */}
          <Card>
            <CardContent className="p-4">
              <Button
                onClick={handleChooseImage}
                disabled={converting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <Plus size={20} color="#ffffff" />
                  <Text className="text-white font-medium">添加图片</Text>
                </View>
              </Button>
            </CardContent>
          </Card>

          {/* 转换按钮 */}
          <Card>
            <CardContent className="p-4">
              <Button
                onClick={handleConvertToPdf}
                disabled={converting || images.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <FileDown size={20} color="#ffffff" />
                  <Text className="text-white font-medium">
                    {converting ? '正在转换...' : '生成 PDF'}
                  </Text>
                </View>
              </Button>
            </CardContent>
          </Card>
        </View>
      </View>
    </View>
  );
};

export default IndexPage;
