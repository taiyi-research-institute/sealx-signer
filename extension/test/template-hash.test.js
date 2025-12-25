import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';

// 🧠 私钥（仅测试用，不要用于生产）
const privateKey =
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const wallet = new ethers.Wallet(privateKey);

// ✅ 1. EIP712 Domain 包含 templateHash
const domain = {
    name: 'MyApp',
    version: '1',
    chainId: 1,
    verifyingContract: '0x1234567890abcdef1234567890abcdef12345678',
    salt: ethers.id(
        '1234567890abcdef1234567890abcdef123456789941234341234134324123'
    ),
};
const md5 = CryptoJS.MD5(
    '1234567890abcdef1234567890abcdef123456789941234341234134324123'
);
console.log(md5.toString(), md5.toString(CryptoJS.enc.Hex));
// ✅ 2. 类型定义
const types = {
    Invoice: [
        { name: 'payer', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
};

// ✅ 3. 签名消息内容
const message = {
    payer: wallet.address,
    amount: ethers.parseEther('1.5'),
};

// ✅ 4. 使用 ethers 签名
async function run() {
    const signature = await wallet.signTypedData(domain, types, message);
    console.log('🖋️ Signature:', signature);

    // ✅ 5. 验证签名
    const recovered = ethers.verifyTypedData(domain, types, message, signature);
    console.log('✅ Recovered address:', recovered);

    console.log(
        '🆗 验证通过：',
        recovered.toLowerCase() === wallet.address.toLowerCase()
    );
}

run();
