import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trash2, Plus, FileDown } from 'lucide-react-taro';

/**
 * 图片转 PDF 工具首页
 */
const IndexPage = () => {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

      const uploadedUrls: string[] = [];
      const totalFiles = res.tempFilePaths.length;

      // 逐个上传图片
      for (let i = 0; i < res.tempFilePaths.length; i++) {
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/images/upload',
            filePath: res.tempFilePaths[i],
            name: 'file',
          });

          console.log('上传结果:', uploadRes);

          // 解析响应数据
          const data = uploadRes.data;
          if (typeof data === 'string') {
            const parsed = JSON.parse(data);
            if (parsed.code === 200 && parsed.data?.url) {
              uploadedUrls.push(parsed.data.url);
            }
          } else if (data && data.code === 200 && data.data?.url) {
            uploadedUrls.push(data.data.url);
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
      if (uploadedUrls.length > 0) {
        setImages([...images, ...uploadedUrls]);
        Taro.showToast({
          title: `成功上传 ${uploadedUrls.length} 张图片`,
          icon: 'success',
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
          images: images,
        },
      });

      console.log('PDF生成结果:', res.data);

      // 解析响应
      const data = res.data;
      if (data && data.code === 200 && data.data?.downloadUrl) {
        const downloadUrl = data.data.downloadUrl;

        // 下载 PDF
        Taro.showLoading({ title: '正在下载PDF...' });
        const downloadRes = await Network.downloadFile({
          url: downloadUrl,
        });

        if (downloadRes.statusCode === 200) {
          // 保存文件到本地
          const filePath = downloadRes.tempFilePath;
          
          // 尝试打开文档（小程序）
          try {
            await Taro.openDocument({
              filePath: filePath,
              fileType: 'pdf',
            });
            Taro.showToast({
              title: 'PDF已下载',
              icon: 'success',
            });
          } catch (err) {
            // H5端不支持 openDocument，直接提示下载成功
            Taro.showToast({
              title: 'PDF下载成功',
              icon: 'success',
            });
          }
        } else {
          throw new Error('下载失败');
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
    <View className="w-full min-h-full bg-neutral-50 flex flex-col">
      {/* 顶部标题栏 */}
      <View className="bg-white px-4 py-6 border-b border-neutral-200">
        <Text className="block text-2xl font-bold text-neutral-900 text-center">
          图片转 PDF 工具
        </Text>
        <Text className="block text-sm text-neutral-500 text-center mt-2">
          上传多张图片，一键生成 PDF 文档
        </Text>
      </View>

      {/* 内容区域 */}
      <View className="flex-1 px-4 py-6">
        {/* 添加图片按钮 */}
        <Card className="mb-6">
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

            {/* 上传进度条 */}
            {uploading && (
              <View className="mt-4">
                <Progress value={uploadProgress} className="w-full" />
                <Text className="block text-sm text-neutral-500 text-center mt-2">
                  上传中 {uploadProgress}%
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 已选图片列表 */}
        {images.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <Text className="block text-lg font-semibold text-neutral-900 mb-4">
                已选图片（{images.length}张）
              </Text>

              <View className="flex flex-col gap-3">
                {images.map((url, index) => (
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
                      src={url}
                      className="w-16 h-16 rounded-lg object-cover"
                      mode="aspectFill"
                    />

                    {/* 图片信息 */}
                    <View className="flex-1 flex flex-col">
                      <Text className="block text-sm font-medium text-neutral-900">
                        图片 {index + 1}
                      </Text>
                      <Text className="block text-xs text-neutral-500 mt-1">
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
            </CardContent>
          </Card>
        )}

        {/* 空状态提示 */}
        {images.length === 0 && !uploading && (
          <View className="flex flex-col items-center justify-center py-16">
            <View className="w-20 h-20 rounded-full bg-neutral-200 flex items-center justify-center mb-4">
              <Plus size={40} color="#737373" />
            </View>
            <Text className="block text-base text-neutral-500 text-center">
              点击上方按钮添加图片
            </Text>
          </View>
        )}

        {/* 转换按钮 */}
        {images.length > 0 && (
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
        )}
      </View>
    </View>
  );
};

export default IndexPage;