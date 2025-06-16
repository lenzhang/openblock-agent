const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🚀 OpenBlock Agent 多平台构建脚本');
console.log(`当前平台: ${os.platform()} ${os.arch()}`);
console.log(`Node.js 版本: ${process.version}`);

// 检查必要的工具
function checkPrerequisites() {
    console.log('\n🔍 检查构建环境...');
    
    try {
        execSync('electron-builder --version', { stdio: 'pipe' });
        console.log('✅ electron-builder 已安装');
    } catch (err) {
        console.error('❌ electron-builder 未安装');
        console.log('请运行: npm install');
        return false;
    }
    
    return true;
}

// 清理之前的构建
function cleanBuild() {
    console.log('\n🧹 清理之前的构建文件...');
    try {
        execSync('npm run clean', { stdio: 'inherit' });
        console.log('✅ 清理完成');
    } catch (err) {
        console.log('⚠️  清理过程中出现警告（可能没有旧文件）');
    }
}

// 下载必要的资源
function fetchResources() {
    console.log('\n📦 下载必要的资源文件...');
    try {
        console.log('正在下载驱动、扩展、固件和工具...');
        execSync('npm run fetch:all', { stdio: 'inherit' });
        console.log('✅ 资源下载完成');
        return true;
    } catch (err) {
        console.error('❌ 资源下载失败:', err.message);
        console.log('⚠️  将尝试继续构建（可能影响功能完整性）');
        return false;
    }
}

// 构建配置
const builds = [
    {
        name: 'macOS Universal (x64 + ARM64)',
        command: 'electron-builder --mac --universal',
        description: '构建 macOS 通用包，兼容 Intel 和 Apple Silicon',
        platform: 'darwin',
        priority: 1
    },
    {
        name: 'Windows x64',
        command: 'electron-builder --win --x64',
        description: '构建 Windows 64位版本',
        platform: 'all',
        priority: 2
    },
    {
        name: 'Linux x64',
        command: 'electron-builder --linux --x64',
        description: '构建 Linux 64位版本',
        platform: 'all',
        priority: 3
    }
];

// 检查平台兼容性
function checkPlatformCompatibility(build) {
    const currentPlatform = os.platform();
    
    if (build.platform === 'all') {
        return true;
    }
    
    if (build.platform === 'darwin' && currentPlatform !== 'darwin') {
        return false;
    }
    
    return true;
}

// 执行构建
async function executeBuild(build) {
    console.log(`\n🔨 构建 ${build.name}...`);
    console.log(`📝 说明: ${build.description}`);
    console.log(`🚀 命令: ${build.command}`);
    
    const startTime = Date.now();
    
    try {
        execSync(build.command, { 
            stdio: 'inherit',
            env: {
                ...process.env,
                // 确保使用正确的架构
                npm_config_target_arch: build.command.includes('--x64') ? 'x64' : 
                                       build.command.includes('--arm64') ? 'arm64' : 
                                       build.command.includes('--universal') ? 'universal' : 'x64'
            }
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ ${build.name} 构建成功！耗时: ${duration}s`);
        return { name: build.name, status: 'success', duration };
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`❌ ${build.name} 构建失败 (耗时: ${duration}s)`);
        console.error('错误信息:', err.message);
        return { name: build.name, status: 'failed', error: err.message, duration };
    }
}

// 主构建流程
async function main() {
    console.log('='.repeat(60));
    
    // 检查环境
    if (!checkPrerequisites()) {
        process.exit(1);
    }
    
    // 清理构建
    cleanBuild();
    
    // 下载资源
    const resourcesOk = fetchResources();
    if (!resourcesOk) {
        console.log('\n⚠️  资源下载不完整，但将继续构建...');
    }
    
    // 过滤可构建的目标
    const availableBuilds = builds.filter(build => {
        const compatible = checkPlatformCompatibility(build);
        if (!compatible) {
            console.log(`⏭️  跳过 ${build.name} (当前平台不支持)`);
        }
        return compatible;
    });
    
    if (availableBuilds.length === 0) {
        console.error('❌ 没有可构建的目标');
        process.exit(1);
    }
    
    console.log(`\n📋 将要构建的目标 (${availableBuilds.length}个):`);
    availableBuilds.forEach((build, index) => {
        console.log(`  ${index + 1}. ${build.name}`);
        console.log(`     ${build.description}`);
    });
    
    // 执行构建
    console.log('\n🏗️  开始构建...');
    const results = [];
    
    for (const build of availableBuilds) {
        const result = await executeBuild(build);
        results.push(result);
        
        // 在构建之间稍作停顿
        if (availableBuilds.indexOf(build) < availableBuilds.length - 1) {
            console.log('\n⏸️  等待 2 秒后继续下一个构建...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // 显示构建结果摘要
    console.log('\n📊 构建结果摘要:');
    console.log('='.repeat(60));
    
    let successCount = 0;
    let failedCount = 0;
    let totalTime = 0;
    
    results.forEach(result => {
        if (result.status === 'success') {
            console.log(`✅ ${result.name} - 成功 (${result.duration}s)`);
            successCount++;
        } else {
            console.log(`❌ ${result.name} - 失败 (${result.duration}s)`);
            failedCount++;
        }
        totalTime += parseFloat(result.duration);
    });
    
    console.log('='.repeat(60));
    console.log(`总计: ${successCount} 成功, ${failedCount} 失败`);
    console.log(`总耗时: ${totalTime.toFixed(1)}s`);
    
    // 检查输出文件
    if (fs.existsSync('./dist')) {
        console.log('\n📁 构建输出文件:');
        const files = fs.readdirSync('./dist');
        if (files.length > 0) {
            files.forEach(file => {
                const filePath = path.join('./dist', file);
                const stats = fs.statSync(filePath);
                const size = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`   📦 ${file} (${size} MB)`);
            });
        } else {
            console.log('   (空目录)');
        }
    } else {
        console.log('\n📁 未找到 dist 目录');
    }
    
    // 最终状态
    if (successCount > 0) {
        console.log('\n🎉 构建完成！');
        
        if (successCount === availableBuilds.length) {
            console.log('✨ 所有目标都构建成功！');
        } else {
            console.log(`⚠️  ${successCount}/${availableBuilds.length} 个目标构建成功`);
        }
        
        console.log('\n📝 构建说明:');
        console.log('• macOS Universal: 兼容 Intel Mac 和 Apple Silicon Mac');
        console.log('• Windows x64: 兼容 64位 Windows 系统');
        console.log('• Linux x64: 兼容 64位 Linux 系统');
        
        console.log('\n🚀 安装说明:');
        console.log('• macOS: 双击 .dmg 文件安装');
        console.log('• Windows: 运行 .exe 安装程序');
        console.log('• Linux: 使用 dpkg -i 安装 .deb 包');
        
    } else {
        console.log('\n💥 所有构建都失败了！');
        console.log('请检查上面的错误信息并解决问题后重试。');
        process.exit(1);
    }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
});

// 运行主程序
main().catch(error => {
    console.error('构建过程中发生错误:', error);
    process.exit(1);
}); 