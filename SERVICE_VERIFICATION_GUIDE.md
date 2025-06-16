# OpenBlock Agent 服务验证指南

## 📡 服务概述

OpenBlock Agent 启动后会运行两个本地服务：

### 1. **OpenBlock Link Server** (端口 20111)
- **功能**: 提供硬件通信服务 (蓝牙、串口等)
- **地址**: `127.0.0.1:20111`
- **协议**: WebSocket
- **端点**: 
  - `/scratch/ble` - 蓝牙低功耗通信
  - `/scratch/serialport` - 串口通信

### 2. **OpenBlock Resource Server** (端口 20120)  
- **功能**: 提供扩展和设备资源服务
- **地址**: `0.0.0.0:20120` (可通过 localhost 访问)
- **协议**: HTTP
- **端点**:
  - `/extensions/en.json` - 扩展列表
  - `/devices/en.json` - 设备列表

## 🔍 验证服务状态

### 方法1: 使用验证脚本
```bash
node verify-services.js
```

### 方法2: 手动检查端口占用
```bash
# 检查端口是否被占用
lsof -i :20111  # Link Server
lsof -i :20120  # Resource Server

# 或使用 netstat
netstat -an | grep 20111
netstat -an | grep 20120
```

### 方法3: 直接访问服务端点
```bash
# 测试 Resource Server (HTTP)
curl http://localhost:20120/extensions/en.json
curl http://localhost:20120/devices/en.json

# 使用浏览器访问
open http://localhost:20120/extensions/en.json
```

## 🚀 启动应用

### 启动步骤：
1. **双击安装包**: 安装 OpenBlock Agent
2. **启动应用**: 从应用程序文件夹或 Launchpad 启动
3. **等待初始化**: 应用需要 10-30 秒来初始化服务
4. **检查托盘图标**: 应该能在系统托盘看到 OpenBlock 图标

### 预期行为：
- ✅ 应用显示在系统托盘
- ✅ 端口 20111 和 20120 被占用
- ✅ Resource Server 响应 HTTP 请求
- ✅ Link Server 接受 WebSocket 连接

## 🐛 故障排除

### 问题1: 应用无法启动
**可能原因**: Native 模块错误
**解决方案**: 
- 检查控制台输出是否有错误信息
- 确认使用正确的架构版本 (arm64 vs x64)

### 问题2: 端口未被占用
**可能原因**: 服务启动失败
**解决方案**:
1. 重启应用
2. 检查是否有其他程序占用端口
3. 查看应用日志

### 问题3: Resource Server 无响应
**可能原因**: 资源文件缺失
**解决方案**:
- 确认应用完整安装
- 重新安装应用

## 📊 健康检查清单

运行验证脚本后，应该看到：

```
✅ 端口 20111 正在被使用
✅ 服务响应正常: WebSocket 连接成功

✅ 端口 20120 正在被使用  
✅ 服务响应正常: HTTP 200
✅ /extensions/en.json - HTTP 200, 数据: X 项
✅ /devices/en.json - HTTP 200, 数据: X 项
```

## 🔗 集成测试

### 使用 Scratch 连接测试：
1. 打开支持 OpenBlock 的 Scratch 编辑器
2. 尝试连接硬件设备
3. 检查是否能加载扩展和设备

### API 测试：
```javascript
// WebSocket 连接测试
const ws = new WebSocket('ws://127.0.0.1:20111/scratch/ble');
ws.onopen = () => console.log('Link Server 连接成功');

// HTTP 请求测试  
fetch('http://localhost:20120/extensions/en.json')
  .then(res => res.json())
  .then(data => console.log('Resource Server 响应正常', data));
```

## 📝 日志查看

应用日志位置：
- **macOS**: `~/Library/Logs/OpenBlock Agent/`
- **Windows**: `%APPDATA%/OpenBlock Agent/logs/`

关键日志信息：
- "socket server listend: http://127.0.0.1:20111" - Link Server 启动
- "socket server listend: http://0.0.0.0:20120" - Resource Server 启动
- Native 模块警告 (正常，不影响功能)

## 🎯 服务用途

### Link Server (20111):
- 与 Arduino、micro:bit 等硬件通信
- 蓝牙设备发现和连接
- 串口设备管理
- 固件上传

### Resource Server (20120):
- 提供扩展库列表
- 设备定义文件
- 本地资源服务
- 离线模式支持 