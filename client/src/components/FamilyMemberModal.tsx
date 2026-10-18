import React, { useState, useEffect, useRef } from 'react';
import { Person, UserRole } from '../types';
import { apiPost, resolveAvatarUrl } from '../api';
import { useApp } from '../context/AppContext';
import { Modal } from './common/Modal';
import { Button, Input } from './ui';

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#64748b', // Slate
];

interface FamilyMemberModalProps {
  isOpen: boolean;
  member: Person | null;
  onClose: () => void;
}

export const FamilyMemberModal: React.FC<FamilyMemberModalProps> = ({ isOpen, member, onClose }) => {
  const { refresh, showToast } = useApp();

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState<string>('');
  const [role, setRole] = useState<UserRole>('child');
  const [color, setColor] = useState('#3b82f6');
  const [pin, setPin] = useState('');
  const [calendarIcalUrl, setCalendarIcalUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const computeAgeFromDob = (d: string): number | null => {
    if (!d) return null;
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const birth = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const now = new Date();
    let a = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
    return Math.max(0, a);
  };

  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setDob(member.dob || '');
      const computed = computeAgeFromDob(member.dob || '');
      setAge(computed !== null ? String(computed) : (member.age !== null && member.age !== undefined ? String(member.age) : ''));
      setRole(member.role || (member.is_admin ? 'parent' : 'child'));
      setColor(member.color || '#3b82f6');
      setPin('');
      setCalendarIcalUrl(member.calendar_ical_url || '');
      if (member.avatar && member.avatar !== 'default_avatar.png') {
        setAvatarPreview(resolveAvatarUrl(member.avatar));
      } else {
        setAvatarPreview(null);
      }
      setSelectedFile(null);
    } else {
      setName('');
      setDob('');
      setAge('');
      setRole('child');
      setColor('#3b82f6');
      setPin('');
      setCalendarIcalUrl('');
      setAvatarPreview(null);
      setSelectedFile(null);
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Name is required', { type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const computed = computeAgeFromDob(dob);
      const payload: any = {
        name: trimmedName,
        dob: dob.trim() || null,
        age: computed !== null ? computed : (age ? Number(age) : null),
        role,
        color,
        calendar_ical_url: calendarIcalUrl.trim() || null,
      };
      if (member?.id) {
        payload.id = member.id;
      }
      if (pin.trim()) {
        payload.pin = pin.trim();
      }

      const res = await apiPost<{ success: boolean; person: any }>('save_person', payload);
      const savedPerson = res.person;

      // If user picked a new photo file, upload it now
      if (selectedFile && savedPerson?.id) {
        const formData = new FormData();
        formData.append('avatar', selectedFile);
        const uploadRes = await fetch(`/api/upload_avatar/${savedPerson.id}`, {
          method: 'POST',
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) {
          throw new Error(uploadJson.error || 'Failed to upload photo');
        }
      }

      showToast(`Saved ${trimmedName}`);
      await refresh();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save member', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={member ? `Edit ${member.name}` : 'Add Family Member'}
      icon="fas fa-user-circle"
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            isLoading={saving}
          >
            {saving ? 'Saving...' : member ? 'Update Member' : 'Add Member'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Avatar Photo Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '92px',
                height: '92px',
                borderRadius: '50%',
                border: `3px solid ${color}`,
                boxShadow: `0 0 16px ${color}44`,
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
              title="Click to change photo"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={name || 'Avatar'}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}
                >
                  {name ? name.slice(0, 2) : '👤'}
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                  color: '#fff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <i className="fas fa-camera" />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />

            <Button
              variant="secondary"
              size="sm"
              icon="fas fa-camera"
              onClick={() => fileInputRef.current?.click()}
              style={{ color: '#93c5fd' }}
            >
              {avatarPreview ? 'Change Photo' : 'Upload Photo'}
            </Button>
          </div>

          {/* Name Input */}
          <Input
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Abby"
            required
          />

          {/* Date of Birth & Dynamic Age Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎂 Date of Birth</span>
              </label>
              <input
                type="date"
                className="modern-input"
                value={dob}
                onChange={(e) => {
                  const val = e.target.value;
                  setDob(val);
                  const calc = computeAgeFromDob(val);
                  if (calc !== null) setAge(String(calc));
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.88rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Age</span>
                {dob && <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>✓ Auto</span>}
              </label>
              <input
                type="number"
                className="modern-input"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={dob ? 'Calculated' : 'e.g. 8'}
                min="0"
                max="120"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.95rem',
                }}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Family Role</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { id: 'child' as UserRole, label: 'Child', desc: 'Chores, rewards & games', icon: 'fa-star' },
                { id: 'parent' as UserRole, label: 'Parent', desc: 'Full family admin access', icon: 'fa-shield-alt' },
              ].map((r) => {
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '10px',
                      background: active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      border: active ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: active ? '#93c5fd' : '#cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <i className={`fas ${r.icon}`} style={{ fontSize: '1.2rem', marginBottom: 2 }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{r.label}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{r.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palette */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Accent Colour</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '3px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: color === c ? '0 0 10px rgba(255,255,255,0.6)' : 'none',
                    transition: 'transform 0.12s ease',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
                title="Custom color"
              />
            </div>
          </div>

          {/* PIN Input (Optional) */}
          <Input
            label={member?.has_pin ? 'PIN Protection (Current PIN set)' : 'PIN Protection (Optional)'}
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={member?.has_pin ? 'Enter new PIN (or leave blank to keep)' : 'Optional 4-digit PIN'}
            helperText="Used when switching to this profile on the shared tablet."
          />

          {/* Personal Google Calendar (.ics) */}
          <Input
            label="Personal Google Calendar (.ics URL)"
            type="url"
            value={calendarIcalUrl}
            onChange={(e) => setCalendarIcalUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
            helperText={`Events from this sub-calendar will automatically appear with ${name ? `${name}'s` : "this person's"} color (${color}).`}
          />

      </form>
    </Modal>
  );
};
