#!/usr/bin/env node
const { exec } = require('child_process');
const path = require('path');

const now = new Date();

// 构建输出文件名
const outputFile = `sealx-${now.getTime()}.crx`;

// 构建命令
const command = `crx pack dist_chrome -p ./extension.pem -o ${outputFile}`;

// 执行命令
exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ 打包失败: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`⚠️ 警告: ${stderr}`);
    }
    console.log(`✅ 打包成功: ${outputFile}`);
});
