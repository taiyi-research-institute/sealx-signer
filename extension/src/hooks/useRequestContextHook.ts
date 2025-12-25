import { useContext } from 'react';
import { RequestContext } from '../context/requestContext';

export const useRequestContext = () => useContext(RequestContext);
