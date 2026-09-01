# 如何添加 GitHub Actions 工作流

由于 GitHub OAuth 权限限制，无法通过 Coze 平台推送 `.github/workflows/` 文件。

你需要在本地手动添加 workflow 文件。

## 步骤

### 1. 拉取最新代码

```bash
git pull origin main
```

### 2. 创建 workflow 目录

```bash
mkdir -p .github/workflows
```

### 3. 创建 workflow 文件

创建文件 `.github/workflows/build-apk.yml`，内容如下：

```yaml
name: Build Android APK

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:  # 允许手动触发

# 添加权限配置
permissions:
  contents: write  # 允许创建 Release

jobs:
  build-apk:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
    
    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '21'
    
    - name: Setup Android SDK
      uses: android-actions/setup-android@v3
    
    - name: Install dependencies
      run: |
        npm install -g pnpm
        pnpm install
    
    - name: Build H5 version
      run: pnpm build:web
    
    - name: Sync Capacitor
      run: |
        npx cap sync android
    
    - name: Build APK
      run: |
        cd android
        chmod +x gradlew
        ./gradlew assembleDebug
    
    - name: Upload APK
      uses: actions/upload-artifact@v4
      with:
        name: app-debug-apk
        path: android/app/build/outputs/apk/debug/app-debug.apk
        retention-days: 30
    
    - name: Create Release
      if: github.event_name == 'workflow_dispatch'
      uses: softprops/action-gh-release@v1
      with:
        files: android/app/build/outputs/apk/debug/app-debug.apk
        tag_name: apk-${{ github.run_number }}
        name: APK Build #${{ github.run_number }}
        draft: false
        prerelease: false
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. 提交并推送

```bash
git add .
git commit -m "ci: 添加 GitHub Actions 工作流"
git push origin main
```

### 5. 触发构建

推送后会自动触发构建，或者：

1. 进入 GitHub 仓库页面
2. 点击 "Actions" 标签
3. 选择 "Build Android APK"
4. 点击 "Run workflow" 手动触发

### 6. 下载 APK

构建完成后（约 10-15 分钟）：

- **自动构建**：在 Actions 页面下载 `app-debug-apk`
- **手动触发**：在 Releases 页面下载

## 注意事项

- 首次构建可能需要 15-20 分钟
- 后续构建约 10 分钟
- APK 文件会保留 30 天
