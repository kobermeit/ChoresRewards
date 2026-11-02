import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { clearOfflineQueue, setOfflineBannerDismissed } from '../../store/uiSlice';
import { Button } from '../../components/ui';
import { useApp } from '../../context/AppContext';

/**
 * Non-blocking offline notice.
 *
 * Replaces the old full-screen "Connection Lost" modal: the household keeps
 * tapping chores / ticking the shopping list, every write is queued, and this
 * banner reports state. It can be collapsed to a small pill and comes back
 * automatically the next time the connection drops.
 *
 * Both states are escapable. The blue "Syncing N changes…" state is derived from
 * the persisted queue, so if a write can never be replayed it used to stay on
 * screen across reloads with no way to clear it — hence the explicit **Discard**
 * control (the sync manager also gives up by itself after a bounded number of
 * attempts).
 */
export const OfflineStatusBanner: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.connectivity.status);
  const dismissed = useAppSelector((state) => state.ui.offlineBannerDismissed);
  const queueLength = useAppSelector((state) => state.ui.offlineQueue.length);
  const servedFromCacheAt = useAppSelector((state) => state.connectivity.servedFromCacheAt);
  const { confirm, showToast } = useApp();

  const [isRetrying, setIsRetrying] = useState(false);

  const isOffline = status === 'offline';

  // A reconnect always restores the full banner for the next outage.
  useEffect(() => {
    if (!isOffline) {
      setIsRetrying(false);
      if (dismissed) dispatch(setOfflineBannerDismissed(false));
    }
  }, [isOffline, dismissed, dispatch]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    window.dispatchEvent(new Event('cr:probe_connection'));
  }, []);

  const handleDiscard = useCallback(async () => {
    const ok = await confirm({
      title: 'Discard saved changes?',
      message: `${queueLength} change${queueLength === 1 ? '' : 's'} saved on this device could not be synced to the server. Discarding them means they will never be applied — you can redo the action instead.`,
      confirmText: 'Discard',
      danger: true,
    });
    if (!ok) return;
    dispatch(clearOfflineQueue());
    dispatch(setOfflineBannerDismissed(false));
    showToast('Discarded unsynced change(s)', { type: 'info' });
  }, [confirm, dispatch, queueLength, showToast]);

  if (!isOffline && queueLength === 0) return null;

  const savedLabel = `${queueLength} saved change${queueLength === 1 ? '' : 's'}`;
  const cachedTime = servedFromCacheAt
    ? new Date(servedFromCacheAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  // Collapsed state: a tappable pill that re-expands the notice.
  if (isOffline && dismissed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        shape="pill"
        icon="📴"
        className="cr-offline-pill"
        onClick={() => dispatch(setOfflineBannerDismissed(false))}
      >
        {queueLength > 0 ? savedLabel : 'Offline'}
      </Button>
    );
  }

  return (
    <div
      className={`cr-offline-banner ${isOffline ? 'cr-offline-banner--offline' : 'cr-offline-banner--syncing'}`}
      role="status"
      aria-live="polite"
    >
      <span className="cr-offline-banner__icon" aria-hidden="true">
        {isOffline ? '📴' : <i className="fas fa-arrows-rotate fa-spin" />}
      </span>

      <div className="cr-offline-banner__body">
        <div className="cr-offline-banner__title">
          {isOffline ? 'Working offline' : `Syncing ${queueLength} change${queueLength === 1 ? '' : 's'}…`}
          {isOffline && queueLength > 0 && <span className="cr-offline-banner__count">{queueLength}</span>}
        </div>
        <div className="cr-offline-banner__subtitle">
          {isOffline
            ? cachedTime
              ? `Showing saved data from ${cachedTime}. New changes are stored on this device and sync automatically.`
              : 'Changes are saved on this device and sync automatically when the connection returns.'
            : 'Finishing up your offline edits…'}
        </div>
      </div>

      <div className="cr-offline-banner__actions">
        <Button variant="ghost" size="sm" icon="🔄" isLoading={isRetrying} onClick={handleRetry}>
          Retry
        </Button>
        {isOffline ? (
          <Button
            variant="ghost"
            size="sm"
            icon="✕"
            aria-label="Dismiss offline notice"
            title="Dismiss"
            onClick={() => dispatch(setOfflineBannerDismissed(true))}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon="✕"
            aria-label="Discard changes that will not sync"
            title="Discard the changes that will not sync"
            onClick={handleDiscard}
          />
        )}
      </div>
    </div>
  );
};
