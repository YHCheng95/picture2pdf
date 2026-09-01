import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Trash2, Plus, FileDown } from 'lucide-react-taro';

/**
 * 图片转 PDF 工具首页
 */
const IndexPage = () => {
  const [images, setImages] = useState<{ url: string; fileName: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pdfFileName, setPdfFileName] = useState('');

  // 选择图片
  const handleChooseImage = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 9, // 最多选择9张
        sizeType: ['compressed'], // 压缩图
        sourceType: ['album', 'camera'], // 相册或相机
      });

      setUploading(true);
      setUploadProgress(0);

      const uploadedImages: { url: string; fileName: string }[] = [];
      const totalFiles = res.tempFilePaths.length;

      // 检测平台
      const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

      console.log('平台检测:', isH5 ? 'H5' : '小程序');
      console.log('选择的图片:', res);

      // 逐个上传图片
      for (let i = 0; i < res.tempFilePaths.length; i++) {
        try {
          let imageUrl: string | null = null;
          let fileName = `图片${i + 1}`;

          if (isH5) {
            // H5 端：直接使用 fetch 上传
            // H5 端的 tempFiles 包含 File 对象
            const file = res.tempFiles?.[i];
            console.log('H5 文件对象:', file);

            if (file) {
              // 获取文件名
              const fileObj = (file as any).originalFileObj || file;
              if (fileObj && fileObj.name) {
                fileName = fileObj.name;
              }

              // 创建 FormData
              const formData = new FormData();
              formData.append('file', fileObj);

              // 使用 fetch 上传
              const response = await fetch(`${PROJECT_DOMAIN}/api/images/upload`, {
                method: 'POST',
                body: formData,
              });

              console.log('H5 上传响应:', response.status);

              if (response.ok) {
                const result = await response.json();
                console.log('H5 上传结果:', result);

                if (result.code === 200 && result.data?.url) {
                  imageUrl = result.data.url;
                }
              } else {
                throw new Error(`上传失败: ${response.status}`);
              }
            }
          } else {
            // 小程序端：使用 Network.uploadFile
            // 从 tempFilePaths 提取文件名
            const filePath = res.tempFilePaths[i];
            const fileNameMatch = filePath.match(/[^/\\]+$/);
            if (fileNameMatch) {
              fileName = fileNameMatch[0];
            }

            const uploadRes = await Network.uploadFile({
              url: '/api/images/upload',
              filePath: filePath,
              name: 'file',
            });

            console.log('小程序上传结果:', uploadRes);

            // 解析响应数据
            const data = uploadRes.data as any;
            if (typeof data === 'string') {
              const parsed = JSON.parse(data);
              if (parsed.code === 200 && parsed.data?.url) {
                imageUrl = parsed.data.url;
              }
            } else if (data && data.code === 200 && data.data?.url) {
              imageUrl = data.data.url;
            }
          }

          if (imageUrl) {
            uploadedImages.push({ url: imageUrl, fileName });
          } else {
            console.error('上传成功但未获取到 URL');
          }

          // 更新进度
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        } catch (err) {
          console.error('上传失败:', err);
          Taro.showToast({
            title: `第 ${i + 1} 张图片上传失败`,
            icon: 'none',
          });
        }
      }

      // 更新图片列表
      if (uploadedImages.length > 0) {
        setImages([...images, ...uploadedImages]);
        Taro.showToast({
          title: `成功上传 ${uploadedImages.length} 张图片`,
          icon: 'success',
        });
      } else {
        Taro.showToast({
          title: '所有图片上传失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('选择图片失败:', err);
      Taro.showToast({
        title: '选择图片失败',
        icon: 'none',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 删除图片
  const handleDeleteImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  // 转换并下载 PDF
  const handleConvertToPdf = async () => {
    if (images.length === 0) {
      Taro.showToast({
        title: '请先上传图片',
        icon: 'none',
      });
      return;
    }

    try {
      setConverting(true);
      Taro.showLoading({ title: '正在生成PDF...' });

      // 调用后端接口生成 PDF
      const res = await Network.request({
        url: '/api/pdf/generate',
        method: 'POST',
        data: {
          images: images.map(img => img.url),
          fileName: pdfFileName || undefined,
        },
      });

      console.log('PDF生成结果:', res.data);

      // 解析响应
      const data = res.data as any;
      if (data && data.code === 200 && data.data?.downloadUrl) {
        const downloadUrl = data.data.downloadUrl;

        // 检测平台
        const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB;

        if (isH5) {
          // H5 端：使用 fetch + blob 下载
          Taro.showLoading({ title: '正在下载PDF...' });
          
          try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
              throw new Error('下载失败');
            }
            
            const blob = await response.blob();
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
              title: 'PDF下载成功',
              icon: 'success',
            });
          } catch (err) {
            console.error('H5 下载失败:', err);
            throw new Error('下载失败，请重试');
          }
        } else {
          // 小程序端：使用 Network.downloadFile
          Taro.showLoading({ title: '正在下载PDF...' });
          const downloadRes = await Network.downloadFile({
            url: downloadUrl,
          });

          if (downloadRes.statusCode === 200) {
            const filePath = downloadRes.tempFilePath;

            // 打开文档
            await Taro.openDocument({
              filePath: filePath,
              fileType: 'pdf',
            });
            
            Taro.showToast({
              title: 'PDF已下载',
              icon: 'success',
            });
          } else {
            throw new Error('下载失败');
          }
        }
      } else {
        throw new Error(data?.msg || 'PDF生成失败');
      }
    } catch (err) {
      console.error('PDF转换失败:', err);
      Taro.showToast({
        title: err.message || 'PDF转换失败',
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
            <View className="flex-1 overflow-y-auto">
              {images.length > 0 ? (
                <View className="flex flex-col gap-3">
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
                        src={image.url}
                        className="w-16 h-16 rounded-lg object-cover"
                        mode="aspectFill"
                      />

                      {/* 图片信息 - 固定宽度，防止挤压其他元素 */}
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
              ) : (
                /* 空状态提示 */
                <View className="flex-1 flex flex-col items-center justify-center py-16">
                  <View className="w-20 h-20 rounded-full bg-neutral-200 flex items-center justify-center mb-4">
                    <Plus size={40} color="#737373" />
                  </View>
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
          {/* 上传进度条 */}
          {uploading && (
            <Card>
              <CardContent className="p-4">
                <Progress value={uploadProgress} className="w-full" />
                <Text className="block text-sm text-neutral-500 text-center mt-2">
                  上传中 {uploadProgress}%
                </Text>
              </CardContent>
            </Card>
          )}

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
                disabled={uploading || converting}
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
                disabled={uploading || converting || images.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <View className="flex flex-row items-center justify-center gap-2">
                  <FileDown size={20} color="#ffffff" />
                  <Text className="text-white font-medium">
                    {converting ? '正在转换...' : '转换并下载 PDF'}
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