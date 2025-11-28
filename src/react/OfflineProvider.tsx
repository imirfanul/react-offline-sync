import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncEngine } from '../core/SyncEngine';
import { SyncConfig } from '../types';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isSyncing: false,
});

interface Props extends SyncConfig {
  children: React.ReactNode;
}

export const OfflineSyncProvider: React.FC<Props> = ({ children, ...config }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize Config
  useEffect(() => {
    syncEngine.configure(config);
  }, [config]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncEngine.subscribe((status) => {
      setIsSyncing(status);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useSyncStatus = () => useContext(OfflineContext);