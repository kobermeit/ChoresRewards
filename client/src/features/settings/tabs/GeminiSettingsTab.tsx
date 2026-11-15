import React, { useState, useEffect } from 'react';
import { Button, Input, Select } from '../../../components/ui';
import { apiGet, apiPost } from '../../../api';
import { useApp } from '../../../context/AppContext';

export const GeminiSettingsTab: React.FC = () => {
  const { showToast } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    apiGet<{ success: boolean; has_key: boolean; model: string }>('settings/gemini')
      .then((res) => {
        if (res) {
          setHasKey(Boolean(res.has_key));
          if (res.model) setModel(res.model);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setTestResult(null);
    try {
      const res = await apiPost<{ success: boolean; has_key: boolean; model: string }>('settings/gemini', {
        api_key: apiKey.trim() ? apiKey.trim() : undefined,
        model: model.trim() || 'gemini-2.0-flash',
      });
      if (res?.success) {
        setHasKey(Boolean(res.has_key));
        if (apiKey.trim()) {
          setApiKey('');
        }
        showToast('Gemini AI settings saved successfully!', { type: 'success' });
      } else {
        showToast('Failed to save Gemini settings', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Error saving Gemini settings', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearKey = async () => {
    setIsSaving(true);
    try {
      const res = await apiPost<{ success: boolean; has_key: boolean; model: string }>('settings/gemini', {
        api_key: '',
        model: model.trim() || 'gemini-2.0-flash',
      });
      if (res?.success) {
        setHasKey(false);
        setApiKey('');
        showToast('Gemini API key removed', { type: 'info' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Error clearing key', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiPost<{ success: boolean; message: string; model: string }>('settings/test_gemini', {
        api_key: apiKey.trim() ? apiKey.trim() : undefined,
        model: model.trim() || 'gemini-2.0-flash',
      });
      if (res?.success) {
        setTestResult({ success: true, message: res.message });
        showToast('Connected to Google Gemini AI!', { type: 'success' });
      } else {
        setTestResult({ success: false, message: res?.message || 'Gemini connection failed' });
        showToast(res?.message || 'Gemini connection failed', { type: 'error' });
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error connecting to Gemini';
      setTestResult({ success: false, message: msg });
      showToast(msg, { type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Overview & Status */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
          >
            <i className="fas fa-wand-magic-sparkles" />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Google Gemini AI Vision
            </div>
            <div style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: 2 }}>
              Powers instant recipe photo OCR, ingredients breakdown, and meal card imports.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasKey ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#86efac',
                background: 'rgba(34, 197, 94, 0.16)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              <i className="fas fa-circle-check" /> Active & Configured
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#fcd34d',
                background: 'rgba(245, 158, 11, 0.16)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              <i className="fas fa-circle-exclamation" /> Not Configured
            </span>
          )}
        </div>
      </div>

      {/* Main Settings Card */}
      <form
        onSubmit={handleSave}
        style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ position: 'relative' }}>
          <Input
            label="Gemini API Key"
            type={showKey ? 'text' : 'password'}
            placeholder={hasKey ? 'Key is configured (enter new key to replace)...' : 'AIzaSy...'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            helperText={
              <span>
                Get a free API key from{' '}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#93c5fd', textDecoration: 'underline' }}
                >
                  Google AI Studio (aistudio.google.com)
                </a>
                .
              </span>
            }
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            style={{
              position: 'absolute',
              right: 12,
              top: 36,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              padding: 4,
            }}
            title={showKey ? 'Hide key' : 'Show key'}
          >
            <i className={showKey ? 'fas fa-eye-slash' : 'fas fa-eye'} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Select
            label="Gemini Model Preset"
            value={
              ['gemini-3.1-flash-lite', 'gemini-3.1-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'].includes(model)
                ? model
                : 'custom'
            }
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                setModel(e.target.value);
              }
            }}
            options={[
              { value: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Recommended - Fast & Cost-Efficient)' },
              { value: 'gemini-3.1-flash', label: 'gemini-3.1-flash (Standard 3.1)' },
              { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
              { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
              { value: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
              { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
              { value: 'custom', label: 'Custom Model ID...' },
            ]}
          />

          <Input
            label="Model Identifier"
            type="text"
            placeholder="gemini-2.0-flash"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            helperText="Must match an official Google Gemini model ID."
          />
        </div>

        {/* Test Result Message Box */}
        {testResult && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: testResult.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: testResult.success
                ? '1px solid rgba(34, 197, 94, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)',
              color: testResult.success ? '#86efac' : '#fca5a5',
            }}
          >
            <i className={testResult.success ? 'fas fa-circle-check' : 'fas fa-circle-exclamation'} />
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <Button
            type="submit"
            variant="primary"
            icon="fas fa-floppy-disk"
            disabled={isSaving}
            isLoading={isSaving}
          >
            Save Gemini Settings
          </Button>

          <Button
            type="button"
            variant="secondary"
            icon="fas fa-plug"
            onClick={handleTestConnection}
            disabled={isTesting || (!apiKey && !hasKey)}
            isLoading={isTesting}
          >
            Test Connection
          </Button>

          {hasKey && (
            <Button
              type="button"
              variant="danger"
              icon="fas fa-trash-can"
              onClick={handleClearKey}
              disabled={isSaving}
            >
              Remove Key
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
