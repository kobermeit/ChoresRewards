import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
import { RecipeItem } from '../../../types';
import { apiGet } from '../../../api';

export interface ImportingRecipeModalProps {
  open: boolean;
  onClose: () => void;
  jobId?: string | null;
  initialRecipeKeys?: Set<string>;
  errorMessage?: string | null;
  onRecipeReady?: (recipe: RecipeItem) => void;
  onNavigateToSettings?: () => void;
}

export const ImportingRecipeModal: React.FC<ImportingRecipeModalProps> = ({
  open,
  onClose,
  jobId,
  initialRecipeKeys,
  errorMessage,
  onRecipeReady,
  onNavigateToSettings,
}) => {
  const [dots, setDots] = useState('');
  const [activeError, setActiveError] = useState<string | null>(errorMessage || null);
  const pollTimerRef = useRef<any>(null);
  const foundRef = useRef(false);

  useEffect(() => {
    setActiveError(errorMessage || null);
  }, [errorMessage]);

  useEffect(() => {
    if (!open) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      foundRef.current = false;
      return;
    }

    // Animated dots effect
    const dotsInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 450);

    // If an error is already set, do not poll
    if (!activeError) {
      pollTimerRef.current = setInterval(async () => {
        if (foundRef.current) return;

        // Preferred path: poll direct job status if jobId is available
        if (jobId) {
          try {
            const res = await apiGet<{
              success: boolean;
              status: 'processing' | 'done' | 'failed' | 'unknown';
              error?: string;
              recipe?: RecipeItem;
            }>(`recipes/transcribe_status/${jobId}`);

            if (res?.status === 'done' && res.recipe) {
              foundRef.current = true;
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              if (onRecipeReady) {
                onRecipeReady(res.recipe);
              }
              onClose();
              return;
            } else if (res?.status === 'failed') {
              setActiveError(res.error || 'Recipe transcription failed.');
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              return;
            }
          } catch {
            // ignore transient poll errors
          }
        }

        // Fallback / parallel path: check bootstrap for newly added recipe
        if (initialRecipeKeys && initialRecipeKeys.size >= 0) {
          try {
            const res = await apiGet<{ recipes?: Record<string, RecipeItem> }>('bootstrap');
            const recipes = res?.recipes || {};
            for (const [key, r] of Object.entries(recipes)) {
              const cleanKey = String(key || r.meal_key || '').toLowerCase().trim();
              if (!initialRecipeKeys.has(cleanKey)) {
                foundRef.current = true;
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                if (onRecipeReady) {
                  onRecipeReady(r);
                }
                onClose();
                return;
              }
            }
          } catch {
            // ignore transient poll errors
          }
        }
      }, 1200);
    }

    return () => {
      clearInterval(dotsInterval);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [open, activeError, jobId, initialRecipeKeys, onRecipeReady, onClose]);

  if (!open) return null;

  const displayError = activeError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={displayError ? 'Transcription Failed' : 'Importing Recipe Photo'}
      icon={displayError ? 'fas fa-triangle-exclamation' : 'fas fa-wand-magic-sparkles'}
      maxWidth={480}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          {displayError && onNavigateToSettings ? (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Dismiss
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="fas fa-sliders"
                onClick={() => {
                  onClose();
                  onNavigateToSettings();
                }}
              >
                Go to Gemini Settings
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={onClose}>
              OK (Run in Background)
            </Button>
          )}
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '16px 8px 8px',
          gap: 16,
        }}
      >
        {displayError ? (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                color: '#ef4444',
              }}
            >
              <i className="fas fa-circle-exclamation" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                Could Not Transcribe Photo
              </div>
              <div style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                {displayError}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.25) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                color: '#a78bfa',
                boxShadow: '0 0 24px rgba(139, 92, 246, 0.25)',
              }}
            >
              <i className="fas fa-spinner fa-spin" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                Transcribing with Gemini AI{dots}
              </div>
              <div style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.45 }}>
                Reading recipe title, quantities, prep details, and cooking method. This usually takes 5 to 10 seconds.
              </div>
              <div style={{ fontSize: '0.78rem', color: '#93c5fd', marginTop: 10 }}>
                You can wait here or click below to continue using the app while it processes.
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
