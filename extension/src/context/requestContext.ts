import { createContext } from 'react';
import type { SealxRequest } from 'sealx-message';
import type { SealxSession } from 'sealx-core';
import type { SealxTopic } from 'sealx-message';


export type RequestContextType = {
    request: SealxRequest<unknown, SealxTopic, never>;
    session: SealxSession | null;
    activeTabHost: string;
    setSession: (session: SealxSession | null) => void;
    setRequest: React.Dispatch<React.SetStateAction<SealxRequest>>;
    setActiveTabHost: (host: string) => void;
    userId: string,
    title: string
};

export const RequestContext = createContext<RequestContextType>({} as RequestContextType);
