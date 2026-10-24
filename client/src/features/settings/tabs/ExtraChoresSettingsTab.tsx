import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiPost } from '../../../api';
import { Button, Input } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';

export const ExtraChoresSettingsTab: React.FC<{ onUpdated?: () => void }> = ({ onUpdated }) => {
  const { data, refresh, showToast, confirm } = useApp();

  const [editingBonusChore, setEditingBonusChore] = useState<any | null>(null);
  const [isNewBonusChore, setIsNewBonusChore] = useState(false);
  const [bonusModalTitle, setBonusModalTitle] = useState('');
  const [bonusModalPoints, setBonusModalPoints] = useState('2');
  const [bonusModalIcon, setBonusModalIcon] = useState('⚡');
  const [bonusModalMinAge, setBonusModalMinAge] = useState('0');
  const [bonusModalMaxAge, setBonusModalMaxAge] = useState('');
  const [bonusModalEnabled, setBonusModalEnabled] = useState(true);
  const [savingBonusChore, setSavingBonusChore] = useState(false);

  const openAddBonusChoreModal = () => {
    setIsNewBonusChore(true);
    setBonusModalTitle('');
    setBonusModalPoints('2');
    setBonusModalIcon('⚡');
    setBonusModalMinAge('0');
    setBonusModalMaxAge('');
    setBonusModalEnabled(true);
    setEditingBonusChore({ id: '' });
  };

  const openEditBonusChoreModal = (chore: any) => {
    setIsNewBonusChore(false);
    setBonusModalTitle(chore.title || '');
    setBonusModalPoints(String(chore.points ?? 2));
    setBonusModalIcon(chore.icon || '⚡');
    setBonusModalMinAge(String(chore.min_age ?? 0));
    setBonusModalMaxAge(chore.max_age !== null && chore.max_age !== undefined ? String(chore.max_age) : '');
    setBonusModalEnabled(chore.enabled !== false);
    setEditingBonusChore(chore);
  };

  const handleSaveBonusChoreModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bonusModalTitle.trim()) {
      showToast('Chore title cannot be empty', { type: 'error' });
      return;
    }
    setSavingBonusChore(true);
    try {
      if (isNewBonusChore) {
        await apiPost('extra_chores/add', {
          title: bonusModalTitle.trim(),
          points: parseFloat(bonusModalPoints) || 2,
          icon: bonusModalIcon.trim() || '⚡',
          min_age: parseInt(bonusModalMinAge, 10) || 0,
          max_age: bonusModalMaxAge.trim() ? parseInt(bonusModalMaxAge, 10) : null,
          enabled: bonusModalEnabled,
        });
        showToast(`Added "${bonusModalTitle.trim()}" to bonus chores`);
      } else {
        await apiPost('extra_chores/update', {
          id: editingBonusChore.id,
          title: bonusModalTitle.trim(),
          points: parseFloat(bonusModalPoints) || 2,
          icon: bonusModalIcon.trim() || '⚡',
          min_age: parseInt(bonusModalMinAge, 10) || 0,
          max_age: bonusModalMaxAge.trim() ? parseInt(bonusModalMaxAge, 10) : null,
          enabled: bonusModalEnabled,
        });
        showToast(`Updated bonus chore "${bonusModalTitle.trim()}"`);
      }
      setEditingBonusChore(null);
      await refresh();
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to save bonus chore', { type: 'error' });
    } finally {
      setSavingBonusChore(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24, borderRadius: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>⚡ Extra Bonus Chores Pool ({(data?.extra_chores || []).length})</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            icon="fas fa-rotate"
            onClick={async () => {
              const ok = await confirm({
                title: 'Reset Bonus Chores?',
                message: 'Are you sure you want to restore the default bonus chores pool? Custom bonus chores will be reset.',
                confirmText: 'Reset Defaults',
                danger: true,
              });
              if (!ok) return;
              await apiPost('extra_chores/reset_defaults', {});
              showToast('Reset Extra Chores to defaults');
              await refresh();
              onUpdated?.();
            }}
          >
            Reset Defaults
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-plus"
            onClick={openAddBonusChoreModal}
          >
            Add Bonus Chore
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data?.extra_chores || []).map((ec) => {
          const ageLabel = ec.max_age
            ? `Ages ${ec.min_age}–${ec.max_age}`
            : ec.min_age > 0
            ? `Age ${ec.min_age}+`
            : 'All ages';

          return (
            <div
              key={ec.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--card-radius)',
                background: 'rgba(255,255,255,0.05)',
                borderLeft: '5px solid #f59e0b',
                opacity: ec.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1.5px solid rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flexShrink: 0,
                  }}
                >
                  {ec.icon || '⚡'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{ec.title}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      {ageLabel}
                    </span>
                    {!ec.enabled && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        Disabled
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>
                      {data?.reward_system === 'cash' ? `$${Number(ec.points).toFixed(2)}` : `+${ec.points} pts`}
                    </span>
                    <span>• Bonus chore pool</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="fas fa-pencil-alt"
                  onClick={() => openEditBonusChoreModal(ec)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon="fas fa-trash-alt"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete Bonus Chore',
                      message: `Are you sure you want to permanently delete "${ec.title}" from the bonus pool?`,
                      confirmText: 'Delete',
                      danger: true,
                    });
                    if (ok) {
                      await apiPost('extra_chores/delete', { id: ec.id });
                      showToast(`Deleted bonus chore "${ec.title}"`);
                      await refresh();
                      onUpdated?.();
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        {(data?.extra_chores || []).length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', opacity: 0.6 }}>
            No extra bonus chores in pool. Tap &quot;Add Bonus Chore&quot; or &quot;Reset Defaults&quot;!
          </div>
        )}
      </div>

      {/* Bonus Chore Add / Edit Modal */}
      {editingBonusChore && (
        <Modal
          open={Boolean(editingBonusChore)}
          onClose={() => setEditingBonusChore(null)}
          title={isNewBonusChore ? 'Add Bonus Chore' : `Edit Bonus Chore: ${editingBonusChore.title || ''}`}
          icon="fas fa-bolt"
          maxWidth={540}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <Button variant="ghost" size="sm" onClick={() => setEditingBonusChore(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="fas fa-check"
                loading={savingBonusChore}
                onClick={() => handleSaveBonusChoreModal()}
              >
                {isNewBonusChore ? 'Add to Pool' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
              <Input
                label="Icon"
                type="text"
                placeholder="⚡"
                value={bonusModalIcon}
                onChange={(e) => setBonusModalIcon(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.2rem' }}
              />
              <Input
                label="Chore Title *"
                placeholder="e.g. Wash the car, Weed garden, Clean oven..."
                value={bonusModalTitle}
                onChange={(e) => setBonusModalTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input
                label="Points / Value"
                type="number"
                step="0.5"
                min="0.1"
                placeholder="2"
                value={bonusModalPoints}
                onChange={(e) => setBonusModalPoints(e.target.value)}
              />
              <Input
                label="Min Age"
                type="number"
                min="0"
                max="18"
                placeholder="0 (all)"
                value={bonusModalMinAge}
                onChange={(e) => setBonusModalMinAge(e.target.value)}
              />
              <Input
                label="Max Age"
                type="number"
                min="0"
                max="18"
                placeholder="Optional"
                value={bonusModalMaxAge}
                onChange={(e) => setBonusModalMaxAge(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="bonusModalEnabledCheckbox"
                checked={bonusModalEnabled}
                onChange={(e) => setBonusModalEnabled(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#f59e0b' }}
              />
              <label htmlFor="bonusModalEnabledCheckbox" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#e2e8f0' }}>
                Active in extra chores pool (visible to children)
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExtraChoresSettingsTab;
