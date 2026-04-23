import { useState, useEffect } from 'react';
import './TransferTest.css';
import {
    signBySealx,
    onLocateElement,
    sendSignResponse,
} from 'sealx-sdk';

function TransferTest() {
    const [status, setStatus] = useState('Ready');
    const [log, setLog] = useState([]);
    const [signature, setSignature] = useState('');

    const addLog = (msg) => {
        console.log(`[TransferTest] ${msg}`);
        const timestamp = new Date().toLocaleTimeString();
        setLog((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
    };

    const updateStatus = (msg) => {
        setStatus(msg);
        addLog(msg);
    };

    // 初始化元素定位功能
    useEffect(() => {
        const unsubscribe = onLocateElement((key, value) => {
            const testDataKey = `${key}.${value}`;
            console.log('[Test] Locate element:', { key, value, testDataKey });
            updateStatus(`Locate: ${key} = ${value}`);

            const element = document.querySelector(`[data-key="${testDataKey}"]`);
            if (element) {
                console.log('[Test] Element found:', element);
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.outline = '3px solid #f59e0b';
                element.style.outlineOffset = '2px';

                setTimeout(() => {
                    element.style.outline = '';
                    element.style.outlineOffset = '';
                }, 3000);
            } else {
                console.log('[Test] Element not found for key:', testDataKey);
            }
        });

        addLog('Element location initialized');

        return () => {
            unsubscribe();
        };
    }, []);

    // 签名函数
    const handleSign = async () => {
        try {
            updateStatus('Signing transaction task...');

            const taskId = 'TRX-8829';
            const taskType = 'eip712';
            const command = 'transfer';

            const signContent = {
                domain: {
                    name: 'custody-transfer',
                    version: '1.0.0',
                    chainId: 1,
                    verifyingContract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
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
                layout: {
                    template: '',
                    keysMapStr: JSON.stringify({
                        'Task ID': { originKey: 'task_id', originType: 'value' },
                        'Command Name': { originKey: 'command', originType: 'value' },
                        'From': { originKey: 'from', originType: 'value' },
                        'To': { originKey: 'to', originType: 'value' },
                        'Amount': { originKey: 'amount', originType: 'value' },
                        'Token': { originKey: 'token', originType: 'value' },
                        'Network': { originKey: 'network', originType: 'value' },
                        'Contract': { originKey: 'contract', originType: 'value' },
                    }),
                },
            };

            const signParams = {
                taskId: taskId,
                taskType: taskType,
                command: command,
                signContent: signContent,
                validUntilTime: Date.now() + 24 * 60 * 60 * 1000,
            };

            addLog('Calling signBySealx...');
            const res = await signBySealx(signParams);

            const signatureResult = res?.result?.signature || res?.signature || '';
            if (!signatureResult) {
                updateStatus('Signature failed: No signature returned');
                return;
            }

            setSignature(signatureResult);
            updateStatus(`Signature: ${signatureResult.substring(0, 20)}...`);
            sendSignResponse(taskId);
        } catch (e) {
            updateStatus(`Error: ${e}`);
            console.error('Sign error:', e);
        }
    };

    const handleBack = () => {
        window.location.href = '/';
    };

    return (
        <div className="transfer-test-page">
            {/* Header */}
            <header className="header">
                <div className="header-left">
                    <button className="back-btn" onClick={handleBack}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                    </button>
                    <h1 className="header-title">Review Task #1</h1>
                    <span className="status-badge waiting">
                        <span className="status-dot"></span>
                        Wait for Sign
                    </span>
                </div>
                <div className="header-right">
                    <span className="status-text">Status: {status}</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <div className="content-wrapper">
                    <div className="grid-layout">
                        {/* Left Column: Transaction Details */}
                        <div className="left-column">
                            <div className="card transaction-card">
                                <div className="card-header">
                                    <h2>Transaction Details</h2>
                                    <span className="badge transfer-badge" data-key="command.transfer">Transfer</span>
                                </div>
                                <div className="card-body">
                                    {/* Amount Display */}
                                    <div className="amount-section">
                                        <span className="amount-label">Transfer Amount</span>
                                        <div className="amount-display">
                                            <span className="amount-value" data-key="amount.50000.00">50,000.00</span>
                                            <span className="amount-token" data-key="token.USDT">USDT</span>
                                        </div>
                                        <div className="network-info">
                                            <div className="network-badge">
                                                <span className="network-icon">T</span>
                                                <span data-key="network.Ethereum Mainnet">ERC-20 (Ethereum Mainnet)</span>
                                            </div>
                                            <div className="contract-link" data-key="contract.0xdac17f958d2ee523a2206206994597c13d831ec7">
                                                <span>Contract:</span>
                                                <span className="contract-address">0xdac1...1ec7</span>
                                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* From / To Grid */}
                                    <div className="from-to-grid">
                                        {/* From Card */}
                                        <div className="account-card from-card">
                                            <div className="account-type-label">From</div>
                                            <div className="account-header">
                                                <div className="account-avatar from-avatar">P</div>
                                                <div className="account-info">
                                                    <div className="account-name" data-key="from.name.Payment Account">Payment Account</div>
                                                    <div className="account-id" data-key="from.account_id.88293049">ID: 88293049</div>
                                                </div>
                                            </div>
                                            <div className="account-address-section">
                                                <div className="address-label">Address</div>
                                                <div className="address-value" data-key="from.0x71C765df7C2F7bF0F61F6d9C1d5d5c9a3b2f1e0d9">
                                                    <span>0x71C...9A23</span>
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="travel-rule-section">
                                                <div className="travel-rule-header">
                                                    <span className="travel-dot"></span>
                                                    <span className="travel-rule-label">Originator (Travel Rule)</span>
                                                </div>
                                                <div className="travel-rule-content">
                                                    <div className="travel-rule-name">Digital Account Fdn.</div>
                                                    <div className="travel-rule-location">
                                                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                        </svg>
                                                        Singapore
                                                    </div>
                                                    <div className="travel-rule-badges">
                                                        <span className="badge verified">
                                                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                            </svg>
                                                            Verified
                                                        </span>
                                                        <span className="badge vasp">VASP: Cregis</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Connector */}
                                        <div className="connector">
                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                                            </svg>
                                        </div>

                                        {/* To Card */}
                                        <div className="account-card to-card">
                                            <div className="account-type-label">To</div>
                                            <div className="account-header">
                                                <div className="account-avatar to-avatar">C</div>
                                                <div className="account-info">
                                                    <div className="account-name" data-key="to.name.Creative Solutions Ltd">Creative Solutions Ltd</div>
                                                    <div className="account-id">Alias</div>
                                                </div>
                                            </div>
                                            <div className="account-address-section">
                                                <div className="address-label">Address</div>
                                                <div className="address-value" data-key="to.0x89a4238c1aB4c9d8f6e2f1a0c3b5d7e9f2a1c3b5">
                                                    <span>0x89a42...B4c9</span>
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="travel-rule-section">
                                                <div className="travel-rule-header">
                                                    <span className="travel-dot"></span>
                                                    <span className="travel-rule-label">Beneficiary (Travel Rule)</span>
                                                </div>
                                                <div className="travel-rule-content">
                                                    <div className="travel-rule-name">Creative Solutions Ltd</div>
                                                    <div className="travel-rule-location">
                                                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                        </svg>
                                                        British Virgin Islands
                                                    </div>
                                                    <div className="travel-rule-badges">
                                                        <span className="badge verified">
                                                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                            </svg>
                                                            Verified
                                                        </span>
                                                        <span className="badge vasp">VASP: Binance</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Proposal */}
                                    <div className="proposal-section">
                                        <label className="proposal-label">Proposal</label>
                                        <div className="proposal-content">
                                            Urgent payment for Q3 marketing services to vendor 'Creative Solutions Ltd' inclusive of all applicable taxes and service fees as per the agreement dated 2023-10-15.
                                        </div>
                                    </div>

                                    {/* Meta Info */}
                                    <div className="meta-info-grid">
                                        <div className="meta-item">
                                            <div className="meta-label">Unit</div>
                                            <div className="meta-value unit-value">
                                                <span className="unit-icon">
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10l4-4v12l-4-4H3z"></path>
                                                    </svg>
                                                </span>
                                                <span data-key="unit.Everypay">Everypay</span>
                                            </div>
                                        </div>
                                        <div className="meta-item">
                                            <div className="meta-label">Created At</div>
                                            <div className="meta-value">Today, 10:30 AM</div>
                                        </div>
                                        <div className="meta-item">
                                            <div className="meta-label">Expires In</div>
                                            <div className="meta-value expiry-warning">23h 50m</div>
                                        </div>
                                        <div className="meta-item">
                                            <div className="meta-label">Task ID</div>
                                            <div className="meta-value task-id" data-key="task_id.TRX-8829">#TRX-8829</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Approval Flow */}
                        <div className="right-column">
                            <div className="card approval-card">
                                <div className="card-header">
                                    <h2>Approval Flow</h2>
                                </div>
                                <div className="card-body">
                                    <div className="flow-timeline">
                                        {/* Step 1: Initiated */}
                                        <div className="flow-step completed">
                                            <div className="step-dot">
                                                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                </svg>
                                            </div>
                                            <div className="step-content">
                                                <span className="step-title">Initiated</span>
                                                <div className="step-user">
                                                    <span className="user-avatar">JD</span>
                                                    <span className="user-name">John Doe</span>
                                                </div>
                                                <span className="step-time">Today, 10:30 AM</span>
                                            </div>
                                        </div>

                                        {/* Step 2: Risk Check */}
                                        <div className="flow-step completed">
                                            <div className="step-dot">
                                                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                </svg>
                                            </div>
                                            <div className="step-content">
                                                <span className="step-title">Risk Policy Check</span>
                                                <span className="step-status success">Passed (Auto)</span>
                                                <span className="step-time">Today, 10:30 AM</span>
                                            </div>
                                        </div>

                                        {/* Step 3: Approval (Current) */}
                                        <div className="flow-step current">
                                            <div className="step-dot pulsing"></div>
                                            <div className="step-content">
                                                <span className="step-title">Awaiting Approval</span>
                                                <div className="step-users">
                                                    <img src="https://ui-avatars.com/api/?name=Admin&background=F59E0B&color=fff" className="user-avatar-img" alt="You" />
                                                    <span className="user-count">+1</span>
                                                    <span className="user-label">You + 1 other</span>
                                                </div>
                                                <div className="threshold-note">
                                                    Threshold: 2 of 3 admins must approve.
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 4: Execution */}
                                        <div className="flow-step pending">
                                            <div className="step-dot"></div>
                                            <div className="step-content">
                                                <span className="step-title">Execution</span>
                                                <span className="step-status">Pending approval</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sticky Bottom Actions */}
            <div className="bottom-actions">
                <div className="task-info" data-key="task_id.TRX-8829">
                    Reviewing task <span className="task-id">#TRX-8829</span>
                </div>
                <div className="action-buttons">
                    <button className="btn btn-reject" onClick={handleBack}>Reject</button>
                    <button className="btn btn-approve" onClick={handleSign}>Approve & Sign</button>
                </div>
            </div>

            {/* Signature Result */}
            {signature && (
                <div className="signature-overlay">
                    <div className="signature-modal">
                        <div className="signature-success">
                            <div className="success-icon">
                                <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 4 12 14.01 9 11.01"></path>
                                </svg>
                            </div>
                            <h3>Signature Completed</h3>
                            <p>Transaction TRX-8829 has been signed successfully</p>
                        </div>
                        <div className="signature-content">
                            <div className="signature-label">
                                Signature Value
                                <button className="copy-btn" onClick={() => {
                                    navigator.clipboard.writeText(signature);
                                    updateStatus('Signature copied!');
                                }}>
                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                    Copy
                                </button>
                            </div>
                            <pre className="signature-value">{signature}</pre>
                        </div>
                        <button className="close-btn" onClick={() => setSignature('')}>Close</button>
                    </div>
                </div>
            )}

            {/* Logs */}
            <div className="logs-panel">
                <div className="logs-header">Logs</div>
                <div className="logs-content">
                    {log.map((item, index) => (
                        <div key={index} className="log-item">{item}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TransferTest;
