import { useState } from 'react'
import './App.css'
import { initSealx, connectSealx, bindSealx, signBySealx, isSealxActive, isSessionAvailable, checkSealx } from 'sealx-sdk'

function App() {
    const [userId] = useState('test-user-001')
    const [status, setStatus] = useState<string>('Ready')
    const [log, setLog] = useState<string[]>([])
    const [signature, setSignature] = useState<string>('')

    const addLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setLog(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)])
    }

    const updateStatus = (msg: string) => {
        setStatus(msg)
        addLog(msg)
    }

    // 测试：检查 SealX 是否激活
    const handleCheckActive = async () => {
        try {
            updateStatus('Checking if SealX is active...')
            const active = await isSealxActive()
            updateStatus(`SealX active: ${active}`)
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    // 测试：检查 SealX 状态
    const handleCheckSealx = async () => {
        try {
            updateStatus('Checking SealX status...')
            const result = await checkSealx()
            updateStatus(`SealX status: ${result || 'Not initialized'}`)
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    // 测试：检查会话是否有效
    const handleCheckSession = async () => {
        try {
            updateStatus('Checking session...')
            const available = isSessionAvailable()
            updateStatus(`Session available: ${available}`)
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    // 测试：初始化
    const handleInit = async () => {
        try {
            updateStatus('Initializing SealX...')
            await initSealx(userId)
            updateStatus('SealX initialized successfully')
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    // 测试：连接
    const handleConnect = async () => {
        try {
            updateStatus('Connecting to SealX...')
            await connectSealx()
            updateStatus('Connected to SealX successfully')
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    // 测试：绑定公钥
    const handleBind = async () => {
        try {
            updateStatus('Binding public key...')
            const pk = await bindSealx(userId)
            updateStatus(`Public key bound: ${pk.substring(0, 20)}...`)
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    // 测试：签名
    const handleSign = async () => {
        try {
            updateStatus('Signing...')

            // 创建测试任务
            const task = {
                taskId: `task-${Date.now()}`,
                taskType: 'eip712',
                command: 'signTypedData',
                validUntilTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                signContent: {
                    domain: {
                        name: 'Ether Mail',
                        version: '1',
                        chainId: 1,
                        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
                    },
                    message: {
                        from: {
                            name: 'Cow',
                            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
                        },
                        to: {
                            name: 'Bob',
                            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
                        },
                        contents: 'Hello, Bob!'
                    },
                    primaryType: 'Mail',
                    types: {
                        EIP712Domain: [
                            { name: 'name', type: 'string' },
                            { name: 'version', type: 'string' },
                            { name: 'chainId', type: 'uint256' },
                            { name: 'verifyingContract', type: 'address' }
                        ],
                        Person: [
                            { name: 'name', type: 'string' },
                            { name: 'wallet', type: 'address' }
                        ],
                        Mail: [
                            { name: 'from', type: 'Person' },
                            { name: 'to', type: 'Person' },
                            { name: 'contents', type: 'string' }
                        ]
                    }
                }
            }

            const sig = await signBySealx(task, userId)
            setSignature(sig as string)
            updateStatus(`Signature: ${(sig as string).substring(0, 20)}...`)
        } catch (e) {
            updateStatus(`Error: ${e}`)
        }
    }

    return (
        <div className="test-container">
            <h1>SealX SDK Test Page</h1>

            <div className="section">
                <h2>User ID: {userId}</h2>
                <p className="status">Status: {status}</p>
            </div>

            <div className="section">
                <h3>Check Status</h3>
                <div className="button-group">
                    <button onClick={handleCheckActive}>Check Active</button>
                    <button onClick={handleCheckSealx}>Check SealX</button>
                    <button onClick={handleCheckSession}>Check Session</button>
                </div>
            </div>

            <div className="section">
                <h3>Initialization</h3>
                <div className="button-group">
                    <button onClick={handleInit}>Init</button>
                    <button onClick={handleConnect}>Connect</button>
                </div>
            </div>

            <div className="section">
                <h3>Operations</h3>
                <div className="button-group">
                    <button onClick={handleBind}>Bind Public Key</button>
                    <button onClick={handleSign}>Sign</button>
                </div>
            </div>

            {signature && (
                <div className="section">
                    <h3>Signature Result</h3>
                    <pre className="signature">{signature}</pre>
                </div>
            )}

            <div className="section">
                <h3>Logs</h3>
                <div className="logs">
                    {log.map((item, index) => (
                        <div key={index} className="log-item">{item}</div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default App
