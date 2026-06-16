import React, { useEffect, useMemo, useState } from 'react';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import { usePopupType } from '@src/hooks/usePopupType';
import { useSessionStore } from '@src/core/state';
import Button from '@src/components/button';
import { VersionFooter } from '../version-footer';
import './styles.css';

const Home: React.FC = () => {
  const navigate = useSealXNavigate();
  const { address } = useGlobalContext();
  const [activeTabHost, setActiveTabHost] = useState('');
  const { isActionPopup, isSidePanel, isLoading: isPopupTypeLoading } = usePopupType();
  const session = useSessionStore.use.session();

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      try {
        if (!tab?.url) return;
        const url = new URL(tab.url);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          setActiveTabHost(url.host);
        }
      } catch {
        setActiveTabHost('');
      }
    });
  }, []);

  const connectedHost = session?.host || activeTabHost || 'Not connected';
  const lockMinutes = useMemo(() => {
    if (!session?.expire) return null;
    return Math.max(0, Math.ceil((session.expire - Date.now()) / 60000));
  }, [session?.expire]);

  const handleAction = (option: string) => {
    // Handle different settings options here
    switch (option) {
      case 'reset-pin':
        navigate('/reset-pin');
        break;
      case 'key-manage':
        // Side Panel 模式下不需要新 tab 打开
        if (!isPopupTypeLoading && isActionPopup && !isSidePanel && chrome?.tabs?.create) {
          chrome.tabs.create({
            url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage') + '#/key-manage',
          });
        } else {
          navigate('/key-manage');
        }
        break;
      case 'set-screen-timer':
        navigate('/set-screen-timer');
        break;
      default:
        break;
    }
  };

  const formatAddress = (addr: string | null) => {
    if (!addr) return 'Not initialized';
    return addr; // Display full address
  };

  return (
    <div className="home-container flex w-full flex-col overflow-auto">
      <div className="home-panel">
        <div className="home-logo">
          <img className="home-logo-img" src="/public/logo/sealx-logo.svg" alt="SealX Logo" />
        </div>

        <div className="home-status-card">
          <div className="home-status-row">
            <span className="home-status-dot" aria-hidden="true"></span>
            <span className="home-status-title">Ready</span>
          </div>
          <div className="home-address-label">Signer address</div>
          <div className="home-address-value">{formatAddress(address)}</div>
          <div className="home-session-line">
            Connected to <span>{connectedHost}</span>
            {lockMinutes !== null && (
              <>
                {' '}
                · locks after <span>{lockMinutes} min</span>
              </>
            )}
          </div>
        </div>

        <div className="home-actions">
          <Button variant="primary" onClick={() => handleAction('key-manage')}>
            Key Management
          </Button>
          <Button variant="secondary" onClick={() => handleAction('reset-pin')}>
            Reset PIN
          </Button>
          <Button variant="secondary" onClick={() => handleAction('set-screen-timer')}>
            Screen Timer
          </Button>
        </div>

        <VersionFooter className="home-version-footer" />
      </div>
    </div>
  );
};

export default Home;
