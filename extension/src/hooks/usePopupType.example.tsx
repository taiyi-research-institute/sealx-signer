import React from 'react';
import { usePopupType } from './usePopupType';

/**
 * Example component demonstrating how to use the usePopupType hook
 */
export const PopupTypeExample: React.FC = () => {
    const { popupType, isLoading, isWindowPopup, isActionPopup, isTabPopup } = usePopupType();

    if (isLoading) {
        return <div>Detecting popup type...</div>;
    }

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h3>Popup Type Detection</h3>
            <div>
                <strong>Popup Type:</strong> {popupType}
            </div>
            <div>
                <strong>Is Window Popup:</strong> {isWindowPopup ? 'Yes' : 'No'}
            </div>
            <div>
                <strong>Is Action Popup:</strong> {isActionPopup ? 'Yes' : 'No'}
            </div>
            <div>
                <strong>Is Tab Popup:</strong> {isTabPopup ? 'Yes' : 'No'}
            </div>

            {isWindowPopup && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f4fd', borderRadius: '4px' }}>
                    This popup was opened via <code>chrome.window.create</code>
                </div>
            )}

            {isActionPopup && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f8f0', borderRadius: '4px' }}>
                    This popup was opened via <code>action.popup</code>
                </div>
            )}

            {isTabPopup && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff0e6', borderRadius: '4px' }}>
                    This popup was opened via <code>chrome.tabs.create</code>
                </div>
            )}

            {popupType === 'unknown' && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                    Unable to determine popup type
                </div>
            )}
        </div>
    );
};

export default PopupTypeExample;
