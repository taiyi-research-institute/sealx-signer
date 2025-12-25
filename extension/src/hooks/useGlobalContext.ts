import { useContext } from 'react';
import { GlobalContext } from '@src/context/globalConext';

export const useGlobalContext = () => useContext(GlobalContext);