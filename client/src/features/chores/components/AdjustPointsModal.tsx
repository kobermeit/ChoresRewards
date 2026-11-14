import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, Select, NumberStepper } from '../../../components/ui';
import { Person } from '../../../types';
import { apiPost } from '../../../api';

export interface AdjustPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: Person[];
  selectedPersonId?: number | null;
  isCash?: boolean;
  onSuccess: (updatedPersonName: string, newPoints: number, isDeduct: boolean, delta: number) => void;
}

export const AdjustPointsModal: React.FC<AdjustPointsModalProps> = ({
  isOpen,
  onClose,
  family,
  selectedPersonId,
  isCash = false,
  onSuccess,
}) => {
  const [personId, setPersonId] = useState<number>(() => {
    if (selectedPersonId) return selectedPersonId;
    return family[0]?.id || 0;
  });
  const [isDeduct, setIsDeduct] = useState(false);
  const [pointsVal, setPointsVal] = useState('5');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevOpenRef = useRef(false);

  // Initialize form state ONLY when the modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      if (selectedPersonId) {
        setPersonId(selectedPersonId);
      } else if (family.length > 0) {
        setPersonId(family[0].id);
      }
      setIsDeduct(false);
      setPointsVal('5');
      setReason('');
      setError(null);
      setSubmitting(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, selectedPersonId]);

  // If family loaded asynchronously and personId is not set, set default personId without resetting form fields
  useEffect(() => {
    if (!personId && family.length > 0) {
      setPersonId(family[0].id);
    }
  }, [family, personId]);

  if (!isOpen) return null;

  const currentMember = family.find((p) => p.id === Number(personId)) || family[0];
  const currentPoints = Math.round(((currentMember?.points || 0) + Number.EPSILON) * 100) / 100;
  const numPoints = Math.max(0, parseFloat(pointsVal) || 0);
  const delta = isDeduct ? -numPoints : numPoints;
  const projectedBalance = Math.round((currentPoints + delta + Number.EPSILON) * 100) / 100;
  const isInvalidNegative = isDeduct && projectedBalance < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!personId) {
      setError('Please select a family member');
      return;
    }
    if (numPoints <= 0) {
      setError('Please enter a points amount greater than 0');
      return;
    }
    if (isInvalidNegative) {
      setError(
        `Cannot deduct ${numPoints} points: ${currentMember?.name} only has ${currentPoints} points. Points cannot go negative.`
      );
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this points adjustment');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost<{
        success: boolean;
        error?: string;
        person_name: string;
        new_points: number;
      }>('adjust_points', {
        person_id: personId,
        points: delta,
        reason: reason.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to adjust points');
        setSubmitting(false);
        return;
      }

      onSuccess(res.person_name || currentMember.name, res.new_points, isDeduct, numPoints);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error communicating with server');
    } finally {
      setSubmitting(false);
    }
  };

  const modeColor = isDeduct ? '#f97316' : '#10b981';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Adjust Points"
      icon="fas fa-coins"
      maxWidth={440}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* 1. Family Member Selector */}
        <div>
          <label
            htmlFor="adjust-points-member"
            style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: 6, color: '#f8fafc' }}
          >
            Family Member
          </label>
          <Select
            id="adjust-points-member"
            value={String(personId)}
            onChange={(e) => {
              setPersonId(Number(e.target.value));
              setError(null);
            }}
            fullWidth
          >
            {family.map((p) => {
              const pts = (p.points || 0) + (p.bonus_points || 0);
              return (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({isCash ? `$${pts.toFixed(2)}` : `${pts} pts`})
                </option>
              );
            })}
          </Select>
        </div>

        {/* 2. Action Direction Mode Toggle (Add vs Deduct) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: 6, color: '#f8fafc' }}>
            Action
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setIsDeduct(false);
                setError(null);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                border: !isDeduct ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                background: !isDeduct ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                color: !isDeduct ? '#34d399' : '#94a3b8',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fas fa-plus-circle" /> Add Points
            </button>

            <button
              type="button"
              onClick={() => {
                setIsDeduct(true);
                setError(null);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                border: isDeduct ? '2px solid #f97316' : '1px solid rgba(255,255,255,0.12)',
                background: isDeduct ? 'rgba(249, 115, 22, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                color: isDeduct ? '#fb923c' : '#94a3b8',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fas fa-minus-circle" /> Deduct Points
            </button>
          </div>
        </div>

        {/* 3. Points Input with NumberStepper */}
        <div>
          <NumberStepper
            label={isDeduct ? 'Points to Deduct' : 'Points to Add'}
            required
            value={pointsVal}
            onChange={(val) => {
              setPointsVal(String(val));
              setError(null);
            }}
            min={isCash ? 0.5 : 1}
            step={isCash ? 0.5 : 1}
            prefix={isCash ? <strong>$</strong> : <i className="fas fa-coins" style={{ color: modeColor }} />}
            presets={isCash ? [1, 5, 10, 20] : [1, 5, 10, 20, 50]}
            buttonsPosition="right"
          />

          {isDeduct && currentPoints > 0 && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setPointsVal(String(currentPoints));
                  setError(null);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: pointsVal === String(currentPoints) ? 'rgba(249, 115, 22, 0.35)' : 'rgba(249, 115, 22, 0.15)',
                  border: pointsVal === String(currentPoints) ? '1px solid #f97316' : '1px solid rgba(249, 115, 22, 0.35)',
                  color: '#fb923c',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <i className="fas fa-coins" /> Deduct Entire Balance ({isCash ? `$${currentPoints.toFixed(2)}` : `${currentPoints} pts`})
              </button>
            </div>
          )}

          {/* Balance Preview Badge */}
          <div
            style={{
              marginTop: 10,
              padding: '6px 12px',
              borderRadius: 8,
              background: isInvalidNegative ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: isInvalidNegative ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.82rem',
              color: isInvalidNegative ? '#fca5a5' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Current: <strong>{isCash ? `$${currentPoints.toFixed(2)}` : `${currentPoints} pts`}</strong></span>
            <span>
              New Balance:{' '}
              <strong style={{ color: isInvalidNegative ? '#ef4444' : modeColor }}>
                {isCash ? `$${projectedBalance.toFixed(2)}` : `${projectedBalance} pts`}
              </strong>
            </span>
          </div>
        </div>

        {/* 4. Reason Textarea (3 lines) */}
        <div>
          <label
            htmlFor="adjust-points-reason"
            style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: 6, color: '#f8fafc' }}
          >
            Reason <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            id="adjust-points-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder={
              isDeduct
                ? 'e.g. Spent $5 at Kmart on a shirt'
                : 'e.g. Helped carry heavy groceries from the car'
            }
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#f8fafc',
              fontSize: '0.9rem',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={isDeduct ? 'warning' : 'primary'}
            disabled={submitting || numPoints <= 0 || isInvalidNegative || !reason.trim()}
            icon={isDeduct ? 'fas fa-minus' : 'fas fa-check'}
            style={{ minWidth: 120, fontWeight: 800 }}
          >
            {submitting ? 'Saving...' : isDeduct ? 'Deduct Points' : 'Add Points'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
