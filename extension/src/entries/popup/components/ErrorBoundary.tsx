import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Side Panel ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
                    <div className="text-2xl font-bold text-red-600 mb-4">Something went wrong</div>
                    <div className="text-gray-600 mb-4 text-sm">{this.state.error?.message}</div>
                    <button
                        onClick={() => {
                            // 先重置状态，尝试恢复 React 树
                            this.setState({ hasError: false, error: null })
                        }}
                        className="px-6 py-2 bg-[#00BE78] text-white rounded-lg hover:bg-[#00A366] transition-colors"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
