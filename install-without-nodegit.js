#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('开始安装依赖，跳过 nodegit...');

try {
  // 首先尝试安装基础依赖，跳过 postinstall 脚本
  console.log('安装基础依赖...');
  execSync('npm install --ignore-scripts --no-optional', { stdio: 'inherit' });
  
  // 删除所有的 nodegit 模块
  console.log('删除 nodegit 模块...');
  const findNodegit = (dir) => {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        if (item === 'nodegit') {
          console.log(`删除: ${itemPath}`);
          execSync(`rm -rf "${itemPath}"`, { stdio: 'inherit' });
        } else if (item === 'node_modules') {
          findNodegit(itemPath);
        }
      }
    }
  };
  
  findNodegit('./node_modules');
  
  // 手动安装 electron
  console.log('手动安装 Electron...');
  if (fs.existsSync('./node_modules/electron')) {
    execSync('cd node_modules/electron && npm run postinstall', { stdio: 'inherit' });
  }
  
  console.log('安装完成！');
  console.log('注意：nodegit 已被删除，某些功能可能不可用。');
  
} catch (error) {
  console.error('安装失败:', error.message);
  process.exit(1);
} 