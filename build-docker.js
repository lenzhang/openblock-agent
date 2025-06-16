const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🐳 Docker 跨平台构建脚本');
console.log(`当前平台: ${os.platform()} ${os.arch()}`);

// 检查 Docker 是否可用
function checkDocker() {
    try {
        execSync('docker --version', { stdio: 'pipe' });
        console.log('✅ Docker 已安装');
        return true;
    } catch (err) {
        console.error('❌ Docker 未安装或不可用');
        console.log('请先安装 Docker: https://docs.docker.com/get-docker/');
        return false;
    }
}

// 清理之前的构建
console.log('🧹 清理之前的构建文件...');
try {
    execSync('npm run clean', { stdio: 'inherit' });
} catch (err) {
    console.log('清理完成（可能没有旧文件）');
}

if (!checkDocker()) {
    process.exit(1);
}

// 构建配置
const builds = [
    {
        name: 'Linux (ARM64)',
        dockerImage: 'electronuserland/builder:20',
        command: 'yarn && yarn build --linux --arm64',
        description: '原生 ARM64 构建（在 ARM64 Mac 上性能最佳）'
    },
    {
        name: 'Linux (x64)',
        dockerImage: 'electronuserland/builder:20',
        command: 'yarn && yarn build --linux --x64',
        description: '使用标准 Linux 构建环境'
    },
    {
        name: 'Windows (x64)',
        dockerImage: 'electronuserland/builder:wine',
        command: 'yarn && yarn build --win --x64',
        description: '使用 Wine 环境构建 Windows 版本'
    },
    {
        name: 'Windows (ia32)',
        dockerImage: 'electronuserland/builder:wine',
        command: 'yarn && yarn build --win --ia32',
        description: '使用 Wine 环境构建 Windows 32位版本'
    }
];

console.log('\n📋 将要构建的目标:');
builds.forEach((build, index) => {
    console.log(`  ${index + 1}. ${build.name}`);
    console.log(`     Docker 镜像: ${build.dockerImage}`);
    console.log(`     说明: ${build.description}`);
});

// 创建 Docker 运行命令
function createDockerCommand(build) {
    const currentDir = process.cwd();
    const projectName = path.basename(currentDir);
    
    return `docker run --rm \\
  --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS|APPVEYOR_|CSC_|_TOKEN|_KEY|AWS_|STRIP|BUILD_') \\
  --env ELECTRON_CACHE="/root/.cache/electron" \\
  --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \\
  -v "${currentDir}:/project" \\
  -v "${projectName}-node-modules:/project/node_modules" \\
  -v ~/.cache/electron:/root/.cache/electron \\
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \\
  ${build.dockerImage} \\
  /bin/bash -c "cd /project && ${build.command}"`;
}

const results = [];

for (const build of builds) {
    console.log(`\n🔨 构建 ${build.name}...`);
    console.log(`📦 使用 Docker 镜像: ${build.dockerImage}`);
    
    try {
        const startTime = Date.now();
        const dockerCommand = createDockerCommand(build);
        
        console.log('🚀 执行 Docker 构建命令...');
        execSync(dockerCommand, { stdio: 'inherit', shell: '/bin/bash' });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ ${build.name} 构建成功！耗时: ${duration}s`);
        results.push({ name: build.name, status: 'success', duration });
    } catch (err) {
        console.error(`❌ ${build.name} 构建失败:`, err.message);
        results.push({ name: build.name, status: 'failed', error: err.message });
    }
}

// 显示构建结果摘要
console.log('\n📊 构建结果摘要:');
console.log('='.repeat(60));

let successCount = 0;
let failedCount = 0;

results.forEach(result => {
    if (result.status === 'success') {
        console.log(`✅ ${result.name} - 成功 (${result.duration}s)`);
        successCount++;
    } else {
        console.log(`❌ ${result.name} - 失败`);
        failedCount++;
    }
});

console.log('='.repeat(60));
console.log(`总计: ${successCount} 成功, ${failedCount} 失败`);

// 检查输出目录
if (fs.existsSync('./dist')) {
    console.log('\n📁 构建输出文件:');
    const files = fs.readdirSync('./dist');
    files.forEach(file => {
        const filePath = path.join('./dist', file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024 / 1024).toFixed(1);
        console.log(`   ${file} (${size} MB)`);
    });
}

// 给出最终建议和说明
if (successCount > 0) {
    console.log('\n🎉 Docker 构建完成！');
    console.log('\n📝 构建说明:');
    console.log('✅ Linux 版本: 原生构建，完全兼容');
    console.log('✅ Windows 版本: 通过 Wine 构建，兼容性良好');
    console.log('❌ macOS 版本: 无法在 Linux 上构建，需要 macOS 系统');
} else {
    console.log('\n💥 所有构建都失败了，请检查错误信息。');
    process.exit(1);
}

console.log('\n💡 关于 macOS 构建:');
console.log('   - macOS 应用只能在 macOS 系统上构建（Apple 的限制）');
console.log('   - 如需 macOS 版本，可以考虑:');
console.log('     1. 使用 macOS 虚拟机（需要 Apple 硬件）');
console.log('     2. 使用 GitHub Actions 的 macOS runner');
console.log('     3. 使用 macOS 云服务器');

console.log('\n🚀 如何在 Linux 服务器上使用:');
console.log('   1. 安装 Docker');
console.log('   2. 运行: npm run build:docker');
console.log('   3. 构建文件将出现在 ./dist 目录中'); 