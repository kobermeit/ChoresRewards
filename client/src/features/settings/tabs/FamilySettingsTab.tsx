import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiPost, resolveAvatarUrl } from '../../../api';
import { Button, Input, FormGrid, FormField } from '../../../components/ui';

export interface FamilySettingsTabProps {
  onUpdated?: () => void;
}

export const FamilySettingsTab: React.FC<FamilySettingsTabProps> = ({ onUpdated }) => {
  const { data, refresh, showToast, confirm, openEditMemberModal } = useApp();

  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonColor, setNewPersonColor] = useState('#3b82f6');
  const [newPersonAge, setNewPersonAge] = useState('');
  const [newPersonAdmin, setNewPersonAdmin] = useState(false);
  const [newPersonPin, setNewPersonPin] = useState('');

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    try {
      const res = await apiPost<{ success: boolean; person?: any }>('add_person', {
        name: newPersonName.trim(),
        color: newPersonColor,
      });
      if (res.success && res.person) {
        if (newPersonAge) {
          await apiPost('save_person_age', { person_id: res.person.id, age: parseInt(newPersonAge, 10) });
        }
        if (newPersonAdmin) {
          await apiPost('save_person_pin', {
            person_id: res.person.id,
            is_admin: true,
            pin: newPersonPin.trim() || '1234',
          });
        }
      }
      setNewPersonName('');
      setNewPersonAge('');
      setNewPersonPin('');
      showToast(`Added ${newPersonName.trim()}`);
      await refresh();
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to add person', { type: 'error' });
    }
  };

  const handleDeletePerson = async (personId: number, name: string) => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: `Are you sure you want to delete ${name} and all of their chores and streaks? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await apiPost('delete_person', { person_id: personId });
    showToast(`Deleted ${name}`);
    await refresh();
    onUpdated?.();
  };

  const handleAdjustPoints = async (personId: number, delta: number) => {
    await apiPost('update_points', { person_id: personId, delta });
    await refresh();
    onUpdated?.();
  };

  return (
    <div className="card" style={{ padding: 24, borderRadius: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>👨‍👩‍👧‍👦 Manage Family Members</h3>
        <Button
          variant="primary"
          size="sm"
          icon="fas fa-user-plus"
          onClick={() => openEditMemberModal(null)}
        >
          Add Member
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {(data?.family || []).map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 'var(--card-radius)',
              background: 'rgba(255,255,255,0.05)',
              borderLeft: `5px solid ${p.color || '#3b82f6'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={resolveAvatarUrl(p.avatar)}
                alt={p.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                }}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.name}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 8,
                      background:
                        p.role === 'parent'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : p.role === 'family'
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                      color:
                        p.role === 'parent'
                          ? '#fbbf24'
                          : p.role === 'family'
                            ? '#60a5fa'
                            : '#34d399',
                      textTransform: 'uppercase',
                    }}
                  >
                    {p.role || (p.is_admin ? 'Parent' : 'Child')}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', opacity: 0.75, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>Balance: {p.points} pts (+{p.bonus_points} bonus) {p.age != null ? `• Age ${p.age}` : ''}</span>
                  {p.calendar_ical_url && (
                    <span style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <i className="fas fa-calendar-check" /> Cal Linked
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-pencil-alt"
                onClick={() => openEditMemberModal(p)}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAdjustPoints(p.id, 1)}
              >
                +1 pt
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAdjustPoints(p.id, -1)}
              >
                -1 pt
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="fas fa-trash-alt"
                onClick={() => handleDeletePerson(p.id, p.name)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h4>➕ Add Family Member</h4>
      <FormGrid onSubmit={handleAddPerson} style={{ alignItems: 'flex-end' }}>
        <FormField colSpan={4}>
          <Input
            label="Name *"
            type="text"
            placeholder="Name"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            required
          />
        </FormField>
        <FormField colSpan={2}>
          <Input
            label="Age"
            type="number"
            placeholder="e.g. 8"
            value={newPersonAge}
            onChange={(e) => setNewPersonAge(e.target.value)}
          />
        </FormField>
        <FormField colSpan={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Color</label>
            <input
              type="color"
              value={newPersonColor}
              onChange={(e) => setNewPersonColor(e.target.value)}
              style={{ width: '100%', height: 42, borderRadius: 'var(--input-radius)', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-base)', cursor: 'pointer', padding: 2, boxSizing: 'border-box' }}
              title="Accent Color"
            />
          </div>
        </FormField>
        <FormField colSpan={2}>
          <div style={{ height: 42, display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={newPersonAdmin}
                onChange={(e) => setNewPersonAdmin(e.target.checked)}
              />
              Parent / Admin
            </label>
          </div>
        </FormField>
        {newPersonAdmin ? (
          <FormField colSpan={2}>
            <Input
              label="PIN"
              type="password"
              placeholder="PIN"
              value={newPersonPin}
              onChange={(e) => setNewPersonPin(e.target.value)}
            />
          </FormField>
        ) : null}
        <FormField colSpan={newPersonAdmin ? 12 : 2}>
          <Button type="submit" variant="primary" icon="fas fa-plus" fullWidth={newPersonAdmin}>
            Add Member
          </Button>
        </FormField>
      </FormGrid>
    </div>
  );
};

export default FamilySettingsTab;
