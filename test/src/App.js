import { useState, useEffect } from 'react';
import './App.css';
import {
    initSealx,
    connectSealx,
    bindSealx,
    signBySealx,
    isSealxActive,
    isSessionAvailable,
    checkSealx,
    registerLocatableKeys,
    onLocateElement,
    sendSignResponse,
} from 'sealx-sdk';

function App() {
    // 每次刷新生成不同的 userId
    const [userId] = useState(
        () =>
            `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    );
    const [status, setStatus] = useState('Ready');
    const [log, setLog] = useState([]);
    const [signature, setSignature] = useState('');
    const [debugInfo, setDebugInfo] = useState('');

    // 获取 sealxSigner 实例
    const sealxSigner = window.sealxSigner;

    // 初始化元素定位功能
    useEffect(() => {
        // 注册可定位的 keys - 与插件端渲染的 data-key 匹配
        // 支持通配符 [*] 匹配数组下标

        // 监听定位消息
        const unsubscribe = onLocateElement((key, value) => {
            // key 是从插件发送的 key（如 'command'）
            // value 是点击的元素的显示值
            // 生成测试用的 data-key: key + '.' + value
            const testDataKey = `${key}.${value}`;
            console.log('[Test] Locate element:', { key, value, testDataKey });

            // 查找对应的元素并高亮
            const element = document.querySelector(
                `[data-key="${testDataKey}"]`,
            );
            if (element) {
                console.log('[Test] Element found:', element);
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.outline = '3px solid #ff0000';
                element.style.backgroundColor = '#fff3cd';

                // 3秒后移除高亮
                setTimeout(() => {
                    element.style.outline = '';
                    element.style.backgroundColor = '';
                }, 3000);
                return element;
            } else {
                console.log('[Test] Element not found for key:', testDataKey);
                // 尝试用模糊匹配
                const elements = document.querySelectorAll(
                    `[data-key^="${key}."]`,
                );
                if (elements.length > 0) {
                    console.log('[Test] Found fuzzy matches:', elements);
                }
                return elements;
            }
        });

        addLog('Element location initialized');

        return () => {
            unsubscribe();
        };
    }, []);

    const addLog = (msg) => {
        const timestamp = new Date().toLocaleTimeString();
        setLog((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
    };

    const updateStatus = (msg) => {
        setStatus(msg);
        addLog(msg);
    };

    // 调试：查看 sealxSigner 状态
    const handleDebug = () => {
        const info = {
            hasSession: !!sealxSigner?.session,
            session: sealxSigner?.session,
            sessionExpire: sealxSigner?.session?.expire,
            now: Date.now(),
            isExpired: sealxSigner?.session
                ? sealxSigner.session.expire < Date.now()
                : 'N/A',
            account: sealxSigner?.account,
            installed: sealxSigner?.installed,
        };
        setDebugInfo(JSON.stringify(info, null, 2));
        addLog('Debug info updated');
        console.log('=== SealX Debug Info ===', info);
    };

    // 测试：检查 SealX 是否激活
    const handleCheckActive = async () => {
        try {
            updateStatus('Checking if SealX is active...');
            const active = await isSealxActive();
            updateStatus(`SealX active: ${active}`);
        } catch (e) {
            updateStatus(`Error: ${e}`);
        }
    };

    // 测试：检查 SealX 状态
    const handleCheckSealx = async () => {
        try {
            updateStatus('Checking SealX status...');
            const result = await checkSealx();
            updateStatus(`SealX status: ${result || 'Not initialized'}`);
        } catch (e) {
            updateStatus(`Error: ${e}`);
        }
    };

    // 测试：检查会话是否有效
    const handleCheckSession = async () => {
        try {
            updateStatus('Checking session...');
            const available = isSessionAvailable();
            updateStatus(`Session available: ${available}`);
        } catch (e) {
            updateStatus(`Error: ${e}`);
        }
    };

    // 测试：初始化
    const handleInit = async () => {
        try {
            updateStatus('Initializing SealX...');
            await initSealx(userId);
            updateStatus('SealX initialized successfully');
        } catch (e) {
            updateStatus(`Error: ${e}`);
        }
    };

    // 测试：连接
    const handleConnect = async () => {
        try {
            updateStatus('Connecting to SealX...');
            await connectSealx();
            updateStatus('Connected to SealX successfully');
        } catch (e) {
            updateStatus(`Error: ${e}`);
        }
    };

    // 测试：绑定公钥
    const handleBind = async () => {
        try {
            updateStatus('Binding public key...');
            const pk = await bindSealx(userId);
            updateStatus(`Public key bound: ${pk.substring(0, 20)}...`);
        } catch (e) {
            updateStatus(`Error: ${e}`);
        }
    };

    // ============================================
    // Story 1.2: 发起签名请求
    // ============================================
    const handleSign = async () => {
        try {
            updateStatus('Signing transaction task...');

            // 创建测试任务 - 使用转账交易签名数据格式
            const taskId = 'TRX-8829';
            const taskType = 'eip712';
            const command = 'transfer';

            // signContent 包含 EIP712 签名数据
            const signContent = {
                domain: {
                    name: 'custody-transfer',
                    version: '1.0.0',
                    chainId: 1, // Ethereum Mainnet
                    verifyingContract: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT Contract
                },
                message: {
                    'Task ID': 'TRX-8829',
                    'Command Name': 'transfer',
                    'From': '0x71C765df7C2F7bF0F61F6d9C1d5d5c9a3b2f1e0d9',
                    'To': '0x89a4238c1aB4c9d8f6e2f1a0c3b5d7e9f2a1c3b5',
                    'Amount': '50000.00',
                    'Token': 'USDT',
                    'Network': 'Ethereum Mainnet',
                    'Contract': '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    'Valid Until': '23h 50m'
                },
                primaryType: 'Transfer',
                types: {
                    EIP712Domain: [
                        { name: 'name', type: 'string' },
                        { name: 'version', type: 'string' },
                        { name: 'chainId', type: 'uint256' },
                        { name: 'verifyingContract', type: 'address' },
                    ],
                    'Transfer': [
                        { name: 'Task ID', type: 'string' },
                        { name: 'Command Name', type: 'string' },
                        { name: 'From', type: 'address' },
                        { name: 'To', type: 'address' },
                        { name: 'Amount', type: 'string' },
                        { name: 'Token', type: 'string' },
                        { name: 'Network', type: 'string' },
                        { name: 'Contract', type: 'string' },
                        { name: 'Valid Until', type: 'string' },
                    ],
                },
                // layout 配置与页面 data-key 对应
                layout: {
                    template: '',
                    keysMapStr: JSON.stringify({
                        'Task ID': {
                            originKey: 'task_id',
                            originType: 'value',
                        },
                        'Command Name': {
                            originKey: 'command',
                            originType: 'value',
                        },
                        'From': {
                            originKey: 'from',
                            originType: 'value',
                        },
                        'To': {
                            originKey: 'to',
                            originType: 'value',
                        },
                        'Amount': {
                            originKey: 'amount',
                            originType: 'value',
                        },
                        'Token': {
                            originKey: 'token',
                            originType: 'value',
                        },
                        'Network': {
                            originKey: 'network',
                            originType: 'value',
                        },
                        'Contract': {
                            originKey: 'contract',
                            originType: 'value',
                        },
                        
                    }),
                },
            };

            // 构建签名参数
            const signParams = {
                taskId: taskId,
                taskType: taskType,
                command: command,
                signContent: signContent,
                validUntilTime: Date.now() + 24 * 60 * 60 * 1000, // 24小时后过期
            };

            addLog('Calling signBySealx...');
            addLog(`Task ID: ${taskId}, Command: ${command}`);
            const res = await signBySealx(signParams);

            const signatureResult =
                res?.result?.signature || res?.signature || '';
            if (!signatureResult) {
                updateStatus('Signature failed: No signature returned');
                return;
            }

            setSignature(signatureResult);
            updateStatus(`Signature: ${signatureResult.substring(0, 20)}...`);

            // 调用 sendSignResponse
            addLog('Calling sendSignResponse...');
            sendSignResponse(taskId);
        } catch (e) {
            updateStatus(`Error: ${e}`);
            console.error('Sign error:', e);
        }
    };

    return (
        <div className='test-container'>
            <h1>SealX SDK Test Page</h1>
            <p className='subtitle'>
                Task Signature Demo (参考 TaskComponent.vue)
            </p>

            <div className='section'>
                <h2>User ID: {userId}</h2>
                <p className='status'>Status: {status}</p>
            </div>

            <div className='section'>
                <h3>Check Status</h3>
                <div className='button-group'>
                    <button onClick={handleCheckActive}>Check Active</button>
                    <button onClick={handleCheckSealx}>Check SealX</button>
                    <button onClick={handleCheckSession}>Check Session</button>
                    <button onClick={handleDebug}>Debug</button>
                </div>
            </div>

            <div className='section'>
                <h3>Initialization</h3>
                <div className='button-group'>
                    <button onClick={handleInit}>Init</button>
                    <button onClick={handleConnect}>Connect</button>
                </div>
            </div>

            <div className='section'>
                <h3>Operations</h3>
                <div className='button-group'>
                    <button onClick={handleBind}>Bind Public Key</button>
                    <button onClick={handleSign}>Sign Task</button>
                </div>
            </div>

            {/* ============================================
                Transfer Test 跳转按钮
                ============================================ */}
            <div className='section'>
                <h3>Transfer Test</h3>
                <p className='hint'>
                    独立的交易签名测试页面
                </p>
                <div className='button-group'>
                    <button onClick={() => window.location.href = '/transfer-test'}>
                        Open Transfer Test Page
                    </button>
                </div>
            </div>

            <div className='section'>
                <h3>签名任务数据 (Element Location Demo)</h3>
                <p className='hint'>
                    点击下方数据项，然后在插件中点击对应的数据项进行定位测试
                </p>
                <div className='order-info'>
                    {/* 基本信息 */}
                    <div className='info-group'>
                        <h4>基本信息</h4>
                        <div className='order-row'>
                            <span className='label'>Command (命令):</span>
                            <span
                                className='value'
                                data-key='command.createFundFlow'>
                                createFundFlow
                            </span>
                        </div>
                        <div className='order-row'>
                            <span className='label'>Biz Code (业务编号):</span>
                            <span
                                className='value'
                                data-key='biz_code.F-P88MN089'>
                                F-P88MN089
                            </span>
                        </div>
                        <div className='order-row'>
                            <span className='label'>Account ID (账户ID):</span>
                            <span
                                className='value'
                                data-key='account_id.4925'>
                                4925
                            </span>
                        </div>
                        <div className='order-row'>
                            <span className='label'>
                                Group Code (群组编号):
                            </span>
                            <span
                                className='value'
                                data-key='group_code.G-338PNI'>
                                G-338PNI
                            </span>
                        </div>
                        <div className='order-row'>
                            <span className='label'>
                                Vault Code (保险库编号):
                            </span>
                            <span
                                className='value'
                                data-key='vault_code.fe49839d-93af-4eeb-a856-eb694c7435a8'>
                                fe49839d-93af-4eeb-a856-eb694c7435a8
                            </span>
                        </div>
                        <div className='order-row'>
                            <span className='label'>
                                Valid Until (有效期至):
                            </span>
                            <span
                                className='value'
                                data-key='valid_until_time.1768451600716'>
                                1768451600716
                            </span>
                        </div>
                    </div>

                    {/* Fund Controls - 资金控制规则 */}
                    <div className='info-group'>
                        <h4>Fund Controls (资金控制规则)</h4>

                        {/* 第一个资金控制项 */}
                        <div className='fund-control-item'>
                            <div className='item-header'>
                                资金控制项 #1 (CLCC)
                            </div>

                            <div className='order-row'>
                                <span className='label'>Coin ID (币种ID):</span>
                                <span
                                    className='value'
                                    data-key='fund_controls.[*].coin_id.CLCC'>
                                    CLCC
                                </span>
                            </div>

                            {/* Fund Control Rules - 控制规则 */}
                            <div className='rules-section'>
                                <div className='rules-header'>
                                    Fund Control Rules (控制规则)
                                </div>

                                {/* 第一个规则项 */}
                                <div className='rule-item'>
                                    <div className='rule-header'>规则 #1</div>

                                    <div className='order-row'>
                                        <span className='label'>
                                            Transaction Limit (单笔限额):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].per_transfer_limit.99999999999'>
                                            99999999999
                                        </span>
                                    </div>
                                    <div className='order-row'>
                                        <span className='label'>
                                            Daily Limit (每日限额):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].daily_transfer_limit.99999999999'>
                                            99999999999
                                        </span>
                                    </div>
                                    <div className='order-row'>
                                        <span className='label'>
                                            Threshold (阈值/签名数):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].threshold.1'>
                                            1
                                        </span>
                                    </div>

                                    {/* Guardians - 监护人列表 */}
                                    <div className='guardians-section'>
                                        <div className='guardians-header'>
                                            Guardians (监护人)
                                        </div>
                                        <div className='guardian-list'>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x3bc2b0836955bba04eb5d9fa31f0a41d5c43b6ee'>
                                                    0x3bc2b0836955bba04eb5d9fa31f0a41d5c43b6ee
                                                </span>
                                            </div>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x7a2d8c5f1e9a3b4d8c6f2a1e5d7c3b9a8f4e2d6'>
                                                    0x7a2d8c5f1e9a3b4d8c6f2a1e5d7c3b9a8f4e2d6
                                                </span>
                                            </div>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x9b4e7d2f6a1c8e3b5d9f0a7c2e6f8d1b3a5c7e9'>
                                                    0x9b4e7d2f6a1c8e3b5d9f0a7c2e6f8d1b3a5c7e9
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 第二个资金控制项 */}
                        <div className='fund-control-item'>
                            <div className='item-header'>
                                资金控制项 #2 (ETH)
                            </div>

                            <div className='order-row'>
                                <span className='label'>Coin ID (币种ID):</span>
                                <span
                                    className='value'
                                    data-key='fund_controls.[*].coin_id.ETH'>
                                    ETH
                                </span>
                            </div>

                            {/* Fund Control Rules - 控制规则 */}
                            <div className='rules-section'>
                                <div className='rules-header'>
                                    Fund Control Rules (控制规则)
                                </div>

                                {/* 第一个规则项 */}
                                <div className='rule-item'>
                                    <div className='rule-header'>规则 #1</div>

                                    <div className='order-row'>
                                        <span className='label'>
                                            Transaction Limit (单笔限额):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].per_transfer_limit.100'>
                                            100
                                        </span>
                                    </div>
                                    <div className='order-row'>
                                        <span className='label'>
                                            Daily Limit (每日限额):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].daily_transfer_limit.500'>
                                            500
                                        </span>
                                    </div>
                                    <div className='order-row'>
                                        <span className='label'>
                                            Threshold (阈值/签名数):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].threshold.2'>
                                            2
                                        </span>
                                    </div>

                                    {/* Guardians - 监护人列表 */}
                                    <div className='guardians-section'>
                                        <div className='guardians-header'>
                                            Guardians (监护人)
                                        </div>
                                        <div className='guardian-list'>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0'>
                                                    0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
                                                </span>
                                            </div>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'>
                                                    0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 第二个规则项 */}
                                <div className='rule-item'>
                                    <div className='rule-header'>规则 #2</div>

                                    <div className='order-row'>
                                        <span className='label'>
                                            Transaction Limit (单笔限额):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].per_transfer_limit.1000'>
                                            1000
                                        </span>
                                    </div>
                                    <div className='order-row'>
                                        <span className='label'>
                                            Daily Limit (每日限额):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].daily_transfer_limit.5000'>
                                            5000
                                        </span>
                                    </div>
                                    <div className='order-row'>
                                        <span className='label'>
                                            Threshold (阈值/签名数):
                                        </span>
                                        <span
                                            className='value'
                                            data-key='fund_controls.[*].fund_control_rules.[*].threshold.3'>
                                            3
                                        </span>
                                    </div>

                                    {/* Guardians - 监护人列表 */}
                                    <div className='guardians-section'>
                                        <div className='guardians-header'>
                                            Guardians (监护人)
                                        </div>
                                        <div className='guardian-list'>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c'>
                                                    0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c
                                                </span>
                                            </div>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d'>
                                                    0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d
                                                </span>
                                            </div>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e'>
                                                    0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e
                                                </span>
                                            </div>
                                            <div className='guardian-item'>
                                                <span
                                                    className='guardian-address'
                                                    data-key='fund_controls.[*].fund_control_rules.[*].guardians.[*].0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f'>
                                                    0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================
                Story 1.4: 签名响应处理
                ============================================ */}
            {signature && (
                <div className='section'>
                    <h3>Signature Result</h3>
                    <div className='signature-result-card'>
                        <div className='signature-success-header'>
                            <div className='success-icon'>
                                <svg
                                    width='20'
                                    height='20'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'>
                                    <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'></path>
                                    <polyline points='22 4 12 14.01 9 11.01'></polyline>
                                </svg>
                            </div>
                            <div className='success-text'>
                                <h4>Signature Completed</h4>
                                <p>Transaction TRX-8829 has been signed successfully</p>
                            </div>
                        </div>
                        <div className='signature-content'>
                            <div className='signature-label'>
                                Signature Value
                                <button
                                    className='copy-btn'
                                    onClick={() => {
                                        navigator.clipboard.writeText(signature);
                                        updateStatus('Signature copied to clipboard!');
                                    }}>
                                    <svg
                                        width='14'
                                        height='14'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2'>
                                        <rect
                                            x='9'
                                            y='9'
                                            width='13'
                                            height='13'
                                            rx='2'
                                            ry='2'></rect>
                                        <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'></path>
                                    </svg>
                                    Copy
                                </button>
                            </div>
                            <pre className='signature'>{signature}</pre>
                        </div>
                    </div>
                </div>
            )}

            {debugInfo && (
                <div className='section'>
                    <h3>Debug Info</h3>
                    <pre className='signature'>{debugInfo}</pre>
                </div>
            )}

            <div className='section'>
                <h3>Logs</h3>
                <div className='logs'>
                    {log.map((item, index) => (
                        <div
                            key={index}
                            className='log-item'>
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default App;
