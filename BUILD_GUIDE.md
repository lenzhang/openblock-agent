# OpenBlock Agent 构建指南

## 🚀 快速构建

### 本地构建（推荐）
```bash
# 构建所有支持的平台
npm run build:all

# 构建特定平台
npm run build -- --mac --universal    # macOS 通用版本
npm run build -- --win --x64          # Windows x64
npm run build -- --linux --x64        # Linux x64
```

### Docker 构建（Linux 服务器）
```bash
# 使用 Docker 构建（支持 Linux + Windows）
npm run build:docker
```

## 📋 平台兼容性

| 构建平台 | 可构建目标 | 说明 |
|----------|------------|------|
| **macOS** | macOS, Windows, Linux | 全平台支持 |
| **Linux** | Linux, Windows | 通过 Wine 构建 Windows |
| **Windows** | Windows, Linux | 无法构建 macOS |

## 📦 构建输出

构建完成后，文件将输出到 `dist/` 目录：

- **macOS**: `*.dmg` 安装包
- **Windows**: `*.exe` 安装程序  
- **Linux**: `*.deb` 或 `*.tar.gz` 包

## 🛠️ 环境要求

### 基础要求
- Node.js 18+
- npm 或 yarn
- electron-builder

### 平台特定要求

#### macOS
```bash
# 无额外要求，开箱即用
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install wine

# CentOS/RHEL  
sudo yum install wine
```

#### Windows
```bash
# 安装 Windows Build Tools
npm install --global windows-build-tools
```

## 🐳 Docker 构建详情

Docker 构建使用官方 electron-builder 镜像，支持：
- Linux x64/ARM64 原生构建
- Windows x64/ia32 通过 Wine 构建

```bash
# 查看 Docker 构建选项
node build-docker.js --help
```

## 🔧 故障排除

### 常见问题

1. **nodegit 编译失败**
   ```bash
   npm install --no-optional
   ```

2. **macOS 图标转换失败**
   ```bash
   npm install dmg-license --save-dev
   ```

3. **Linux 构建缺少依赖**
   ```bash
   sudo apt-get install libnss3-dev libatk-bridge2.0-dev libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2
   ```

## 📝 构建脚本说明

- `build-multiplatform.js`: 智能多平台构建脚本
- `build-docker.js`: Docker 容器化构建脚本

## 🎯 推荐构建流程

1. **开发测试**: `npm run build -- --mac --arm64`
2. **发布准备**: `npm run build:all`
3. **CI/CD**: `npm run build:docker` 