import React from 'react';
import { useApp } from '../../context/AppContext';

export const SyncSplashOverlay: React.FC = () => {
  const { isSyncing } = useApp();
  if (!isSyncing) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{ fontSize: '3rem' }}>🏠</div>
      <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#f8fafc' }}>
        Refreshing Family Hub...
      </div>
      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        Checking chores & household updates
      </div>
    </div>
  );
};
