import { layoutRender, parseSignContent, type SignContent } from 'sealx-core';
import './App.css'

window.addEventListener('message', (event) => {
    const { type, signContent, template, context, messageId } = event.data as {
        type: string,
        signContent: SignContent,
        template: string,
        context: unknown
        messageId: string
    };
    if (type === 'parseContent') {
        try {
            event.source?.postMessage({ type: 'contentParsed', output: parseSignContent(signContent), messageId }, { targetOrigin: '*' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            event.source?.postMessage({ type: 'error', error: errorMessage, messageId }, { targetOrigin: '*' });
        }
    } else if (type === 'render' && template && context) {
        try {
            event.source?.postMessage({ type: 'rendered', output: layoutRender((template), context), messageId }, { targetOrigin: '*' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            event.source?.postMessage({ type: 'error', error: errorMessage, messageId }, { targetOrigin: '*' });
        }
    }
});

function App() {
    return (
        <div></div>
    )
}

export default App
