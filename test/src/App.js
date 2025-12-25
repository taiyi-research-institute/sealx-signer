import './App.css';
import { bindSealx, connectSealx, initSealx } from 'sealx-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
const userId = '98123434123';
function App() {
    const [sealx, setSealx] = useState({
        session: window.sealxSigner.session,
        account: window.sealxSigner.account,
    });
    window.sealxSigner.autoConnectCallback = useCallback(() => {
        setSealx({
            session: null,
            account: null,
        });
    }, [setSealx]);
    const [address, setAddress] = useState('');
    const needConnect = useMemo(() => {
        return !sealx.session || sealx.session.expire < Date.now();
    }, [sealx]);
    const onConnect = useCallback(async () => {
        await connectSealx(userId);
        setSealx({
            session: window.sealxSigner.session,
            account: window.sealxSigner.account,
        });
    }, [setSealx]);
    const onBind = useCallback(async () => {
        const address1 = await bindSealx();
        setAddress(address1);
        setSealx({
            session: window.sealxSigner.session,
            account: window.sealxSigner.account,
        });
    }, [setAddress, setSealx]);
    useEffect(() => {
        initSealx(userId).then(() => {
            setSealx({
                session: window.sealxSigner.session,
                account: window.sealxSigner.account,
            });
        });
    }, [setSealx]);
    return (
        <div
            className='App'
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
            }}>
            {needConnect ? (
                <button
                    style={{
                        margin: 'auto',
                    }}
                    onClick={onConnect}>
                    Connect
                </button>
            ) : (
                sealx.account.pk || (
                    <button
                        style={{
                            margin: 'auto',
                        }}
                        onClick={onBind}>
                        Bind
                    </button>
                )
            )}
            {address}
        </div>
    );
}

export default App;
