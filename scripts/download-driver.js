/* eslint-disable */
const downloadRelease = require('download-github-release');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 优先尝试从fork下载，失败时降级到原始仓库
const users = ['lenzhang', 'openblockcc'];
const repo = 'openblock-driver';
const outputdir = path.join(__dirname, '../drivers');
const leaveZipped = false;

function filterRelease (release) {
    return release.prerelease === false;
}

function filterAsset(asset) {
    return (asset.name.indexOf(os.platform()) >= 0) &&  (asset.name.indexOf(os.arch()) >= 0);
}

if (!fs.existsSync(outputdir)) {
    fs.mkdirSync(outputdir, {recursive: true});
}

async function tryDownload() {
    for (const user of users) {
        try {
            console.log(`尝试从 ${user}/${repo} 下载...`);
            await downloadRelease(user, repo, outputdir, filterRelease, filterAsset, leaveZipped);
            console.log(`✅ 从 ${user}/${repo} 下载成功！`);
            console.log('Tools download complete');
            return;
        } catch (err) {
            console.log(`❌ 从 ${user}/${repo} 下载失败: ${err.message}`);
            if (user === users[users.length - 1]) {
                // 最后一个用户也失败了
                throw err;
            }
        }
    }
}

tryDownload().catch(err => {
    console.error('所有下载源都失败了:', err.message);
    process.exit(1);
});
