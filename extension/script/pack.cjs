#!/usr/bin/env node
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const now = new Date();
const version = process.env.npm_package_version || '0.0.0';

// crx 打包
const crxFile = `sealx-${now.getTime()}.crx`;
const crxCommand = `crx pack dist_chrome -p ./extension.pem -o ${crxFile}`;

// zip 打包
const zipFile = `sealx-v${version}.zip`;

// 删除旧 zip（同名版本号覆盖）
if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
}

exec(crxCommand, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ crx 打包失败: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`⚠️ 警告: ${stderr}`);
    }
    console.log(`✅ crx 打包成功: ${crxFile}`);

    // crx 完成后打 zip
    try {
        execSync(`cd dist_chrome && zip -r ../${zipFile} .`, { stdio: 'inherit' });
        console.log(`✅ zip 打包成功: ${zipFile}`);
    } catch (e) {
        console.error(`❌ zip 打包失败: ${e.message}`);
    }
});
