import React from 'react';
import GlobalMessage from './index';
import { useErrorStore, useSuccessStore } from '@src/core/state';

/**
 * A component that manages global messages by connecting to the error and success stores.
 * This component should be placed at the root level of the application.
 */
const GlobalMessageManager: React.FC = () => {
    const error = useErrorStore.use.error();
    const setError = useErrorStore.use.setError();
    const success = useSuccessStore.use.success();
    const setSuccess = useSuccessStore.use.setSuccess();

    // Determine if we should show error or success message
    const hasError = !!error;
    const hasSuccess = !!success;

    // Get error message text
    const errorMessage = error
        ? typeof error === 'string'
            ? error
            : error?.message || 'An unknown error occurred'
        : '';

    // Determine which message to show (priority: error > success)
    const showError = hasError;
    const showSuccess = hasSuccess && !hasError;

    return (
        <>
            {showError && (
                <GlobalMessage
                    message={errorMessage}
                    type="error"
                    visible={true}
                    onDismiss={() => setError(null)}
                    autoDismissDuration={5000}
                    showProgress={true}
                    showCloseButton={true}
                />
            )}
            {showSuccess && (
                <GlobalMessage
                    message={success}
                    type="success"
                    mode='top'
                    visible={true}
                    onDismiss={() => setSuccess('')}
                    autoDismissDuration={5000}
                    showProgress={true}
                    showCloseButton={true}
                />
            )}
        </>
    );
};

export default GlobalMessageManager;
