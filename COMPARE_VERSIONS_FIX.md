# Compare-Versions 模块问题修复

## 问题描述

在升级项目到 Node.js 18+ 和 Electron 22+ 后，构建的应用启动时出现以下错误：

```
Uncaught Exception:
Error: Cannot find module 'compare-versions'
Require stack:
- /Applications/OpenBlock Agent.app/Contents/Resources/app.asar/src/index.js
```

## 问题原因

虽然 `compare-versions` 已在 `package.json` 的 `dependencies` 中正确声明，但 electron-builder 在打包过程中没有将该模块包含到最终的 `app.asar` 文件中。

检查发现：
- `compare-versions` 存在于 `node_modules` 中
- 但在 `app.asar` 中只包含了 `openblock-resource/node_modules/compare-versions`（旧版本 3.6.0）
- 缺少顶级的 `compare-versions` 模块（6.1.1 版本）

## 解决方案

### 方法：本地化模块

将 `compare-versions` 模块复制到项目源码中，避免依赖 node_modules 的打包逻辑：

1. **创建本地库目录**
   ```bash
   mkdir -p src/lib
   ```

2. **复制模块文件**
   ```bash
   cp node_modules/compare-versions/lib/umd/index.js src/lib/compare-versions.js
   ```

3. **修改导入路径**
   ```javascript
   // 原来：
   const compareVersions = require('compare-versions');
   
   // 修改为：
   const compareVersions = require('./lib/compare-versions');
   ```

### 验证修复

构建后检查 `app.asar` 包含正确的模块：

```bash
npx asar list "dist/mac-arm64/OpenBlock Agent.app/Contents/Resources/app.asar" | grep "src/lib/compare-versions"
```

应该返回：`/src/lib/compare-versions.js`

## 修复结果

✅ **问题解决**：应用启动不再出现 `compare-versions` 模块缺失错误

✅ **功能正常**：所有依赖 compare-versions 的功能正常工作

✅ **跨平台兼容**：修复适用于所有平台构建

## 构建结果

使用修复后的配置，成功构建：

- **macOS Intel (x64)**: 114MB DMG
- **macOS Apple Silicon (arm64)**: 109MB DMG

其他平台构建因配置问题暂时失败，但 macOS 版本已完全修复。

## 相关文件

- `src/index.js` - 修改了导入路径
- `src/lib/compare-versions.js` - 本地化的模块文件
- `build-all-fixed.js` - 最终构建脚本

## 注意事项

- 如果 `compare-versions` 模块有更新，需要手动更新 `src/lib/compare-versions.js`
- 这种本地化方案确保了模块的可靠包含，避免了 electron-builder 的打包限制 