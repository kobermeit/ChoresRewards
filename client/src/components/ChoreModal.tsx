import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, Person } from '../types';
import { apiPost, resolveAssetUrl } from '../api';
import { Modal } from './common/Modal';
import { UserAvatar } from './ui/UserAvatar';
import { Button, Input, NumberStepper, DurationStepper } from './ui';
import { FormErrorAlert } from './FormErrorAlert';

const DEFAULT_CHORE_SUGGESTIONS = [
  'Clean bedroom',
  'Make bed',
  'Pack school bag',
  'Empty dishwasher',
  'Feed pets',
  'Walk the dog',
  'Take out bins',
  'Fold laundry',
  'Brush teeth',
  'Do homework',
  'Tidy playroom',
  'Set the dinner table',
  'Put away shoes',
  'Sweep the floor',
  'Water the plants',
  'Wipe down kitchen bench',
  'Put away groceries',
];

export const STOCK_CHORE_IMAGES = [
  { url: '/static/images/chores/chore_lunchbox.svg', label: 'Lunchbox on Bench' },
  { url: '/static/images/chores/chore_dishes.svg', label: 'Dishes & Sink' },
  { url: '/static/images/chores/chore_bed.svg', label: 'Make Bed' },
  { url: '/static/images/chores/chore_tidy_room.svg', label: 'Tidy Room' },
  { url: '/static/images/chores/chore_trash.svg', label: 'Take Out Bins' },
  { url: '/static/images/chores/chore_feed_pets.svg', label: 'Feed Pets' },
  { url: '/static/images/chores/chore_walk_dog.svg', label: 'Walk the Dog' },
  { url: '/static/images/chores/chore_homework.svg', label: 'Do Homework' },
  { url: '/static/images/chores/chore_teeth.svg', label: 'Brush Teeth' },
  { url: '/static/images/chores/chore_laundry.svg', label: 'Fold Laundry' },
  { url: '/static/images/chores/chore_vacuum.svg', label: 'Vacuum & Sweep' },
  { url: '/static/images/chores/chore_table.svg', label: 'Set Table' },
  { url: '/static/images/chores/chore_plants.svg', label: 'Water Plants' },
  { url: '/static/images/chores/chore_wipe_bench.svg', label: 'Wipe Bench' },
  { url: '/static/images/chores/chore_backpack.svg', label: 'Pack School Bag' },
  { url: '/static/images/chores/chore_shoes.svg', label: 'Put Away Shoes' },
];

const DAYS_OF_WEEK = [
  { key: 'monday', short: 'Mon', initial: 'M' },
  { key: 'tuesday', short: 'Tue', initial: 'T' },
  { key: 'wednesday', short: 'Wed', initial: 'W' },
  { key: 'thursday', short: 'Thu', initial: 'T' },
  { key: 'friday', short: 'Fri', initial: 'F' },
  { key: 'saturday', short: 'Sat', initial: 'S' },
  { key: 'sunday', short: 'Sun', initial: 'S' },
];

export const ChoreModal: React.FC = () => {
  const {
    data,
    refresh,
    showToast,
    editingChoreModalItem,
    closeEditChoreModal,
    activeUser,
  } = useApp();

  const isOpen = editingChoreModalItem !== undefined;
  const isEditing = Boolean(editingChoreModalItem && editingChoreModalItem.id);
  const chore = editingChoreModalItem || null;

  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [points, setPoints] = useState('1');
  const [isRepeating, setIsRepeating] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDatetime, setDueDatetime] = useState('');
  const [isTimeBased, setIsTimeBased] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(600);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stockPickerOpen, setStockPickerOpen] = useState(false);

  // Search combobox dropdown state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const family = (data?.family || []).filter(
    (p) => p.role !== 'family' && p.name.toLowerCase() !== 'family'
  );

  const isCash = data?.reward_system === 'cash';

  // Build list of chore suggestions combining defaults + distinct existing chores
  const chorePool = React.useMemo(() => {
    const existing = (data?.chores || []).map((c) => c.title.trim()).filter(Boolean);
    const combined = Array.from(new Set([...DEFAULT_CHORE_SUGGESTIONS, ...existing]));
    return combined;
  }, [data?.chores]);

  const filteredSuggestions = React.useMemo(() => {
    const q = title.trim().toLowerCase();
    if (!q) return chorePool.slice(0, 8);
    return chorePool.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [chorePool, title]);

  // Click outside listener for combobox dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize or reset form whenever modal opens or editing item changes
  useEffect(() => {
    if (!isOpen) {
      setFormError(null);
      setImageFile(null);
      setImagePreview(null);
      setRemoveImage(false);
      return;
    }

    if (chore && chore.id) {
      setTitle(chore.title || '');
      setAssignedTo(chore.assigned_to || (family[0]?.name ?? ''));
      setPoints(String(chore.points ?? 1));
      setIsRepeating(Boolean(chore.is_daily));

      let daysArr: string[] = [];
      if (chore.days_of_week) {
        daysArr = chore.days_of_week
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
      }
      setSelectedDays(daysArr);

      if (chore.due_datetime) {
        setHasDueDate(true);
        setDueDatetime(chore.due_datetime.replace(' ', 'T').slice(0, 16));
      } else {
        setHasDueDate(false);
        setDueDatetime('');
      }

      if (chore.duration_seconds && chore.duration_seconds > 0) {
        setIsTimeBased(true);
        setDurationSeconds(chore.duration_seconds);
      } else {
        setIsTimeBased(false);
        setDurationSeconds(600);
      }

      setImageUrl(chore.image_url || null);
      setImagePreview(chore.image_url ? resolveAssetUrl(chore.image_url) : null);
      setImageFile(null);
      setRemoveImage(false);
    } else {
      // New chore defaults
      setTitle('');
      // Assign to specified person (if opened from lane), active user if child/member, else first family member
      const matchedAssignee =
        chore?.assigned_to ||
        (chore?.assigned_to_id ? family.find((p) => p.id === chore.assigned_to_id)?.name : null);
      const defaultAssignee =
        matchedAssignee ||
        (activeUser && activeUser.role !== 'family'
          ? activeUser.name
          : family[0]?.name || '');
      setAssignedTo(defaultAssignee);
      setPoints('1');
      setIsRepeating(false);
      setSelectedDays([]);
      setHasDueDate(false);
      setDueDatetime('');
      setIsTimeBased(false);
      setDurationSeconds(600);
      setImageUrl(null);
      setImagePreview(null);
      setImageFile(null);
      setRemoveImage(false);
    }
    setFormError(null);
  }, [isOpen, chore]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setRemoveImage(false);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    setRemoveImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayKey)) {
        return prev.filter((d) => d !== dayKey);
      }
      return [...prev, dayKey];
    });
  };

  const handleSelectAllDays = () => {
    setSelectedDays(DAYS_OF_WEEK.map((d) => d.key));
  };

  const handleSelectWeekdays = () => {
    setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  };

  const handleSelectWeekends = () => {
    setSelectedDays(['saturday', 'sunday']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Please enter a chore title');
      return;
    }
    if (!assignedTo) {
      setFormError('Please assign this chore to a family member');
      return;
    }

    const numPoints = parseFloat(points);
    if (isNaN(numPoints) || numPoints < 0) {
      setFormError('Please enter a valid points value');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const formData = new FormData();
      if (isEditing && chore) {
        formData.append('chore_id', String(chore.id));
      }
      formData.append('title', trimmedTitle);
      formData.append('assigned_to', assignedTo);
      formData.append('points', String(numPoints));
      formData.append('is_daily', isRepeating ? 'true' : 'false');

      if (isRepeating && selectedDays.length > 0) {
        formData.append('days_of_week', selectedDays.join(','));
      }

      if (hasDueDate && dueDatetime) {
        formData.append('due_datetime', dueDatetime);
      } else {
        formData.append('due_datetime', '');
      }

      if (isTimeBased) {
        formData.append('duration_seconds', String(Math.max(10, durationSeconds)));
      } else {
        formData.append('duration_seconds', '0');
      }

      if (imageFile) {
        formData.append('chore_image_file', imageFile);
      } else if (removeImage) {
        formData.append('remove_image', 'true');
      } else if (imageUrl) {
        formData.append('image_url', imageUrl);
      }

      const endpoint = isEditing ? 'edit_chore' : 'add_chore';
      const res = await apiPost<{ success: boolean; error?: string }>(endpoint, formData);

      if (res && res.success) {
        showToast(
          isEditing
            ? `Chore "${trimmedTitle}" updated!`
            : `Chore "${trimmedTitle}" added for ${assignedTo}!`
        );
        closeEditChoreModal();
        await refresh();
      } else {
        setFormError(res?.error || 'Failed to save chore');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save chore');
    } finally {
      setSubmitting(false);
    }
  };

  const assignedPerson = family.find((p) => p.name === assignedTo);
  const memberColor = assignedPerson?.color || '#3b82f6';

  return (
    <Modal
      open={isOpen}
      onClose={closeEditChoreModal}
      title={isEditing ? 'Edit Chore' : 'Add Chore'}
      icon={isEditing ? 'fas fa-pencil-alt' : 'fas fa-plus-circle'}
      maxWidth={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="secondary" onClick={closeEditChoreModal} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={(e) => handleSubmit(e as any)}
            disabled={submitting}
            icon={isEditing ? 'fas fa-check' : 'fas fa-plus'}
          >
            {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Chore'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <FormErrorAlert error={formError} onDismiss={() => setFormError(null)} />

        {/* 1. Chore Title with Searchable Suggestions Combobox */}
        <div style={{ position: 'relative' }} ref={comboboxRef}>
          <label
            style={{
              display: 'block',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #f8fafc)',
              marginBottom: 6,
            }}
          >
            Chore Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="modern-input"
              placeholder="e.g. Clean your room, Empty dishwasher, Make bed..."
              value={title}
              onFocus={() => setComboboxOpen(true)}
              onChange={(e) => {
                setTitle(e.target.value);
                setComboboxOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setComboboxOpen(false);
              }}
              autoComplete="off"
              required
              style={{
                width: '100%',
                paddingRight: '36px',
                height: '42px',
                fontSize: '0.92rem',
              }}
            />
            <button
              type="button"
              onClick={() => setComboboxOpen((prev) => !prev)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '0.8rem',
              }}
              title="Browse chore suggestions"
            >
              <i className={`fas fa-chevron-${comboboxOpen ? 'up' : 'down'}`} />
            </button>
          </div>

          {/* Combobox Dropdown */}
          {comboboxOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 9999,
                marginTop: 4,
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                overflow: 'hidden',
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                Suggestions
              </div>
              {filteredSuggestions.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setTitle(s);
                    setComboboxOpen(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.88rem',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <i className="fas fa-check-circle" style={{ color: '#38bdf8', fontSize: '0.75rem' }} />
                  <span>{s}</span>
                </div>
              ))}
              {title.trim() &&
                !chorePool.some((c) => c.toLowerCase() === title.trim().toLowerCase()) && (
                  <div
                    onClick={() => setComboboxOpen(false)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                      color: '#93c5fd',
                      cursor: 'pointer',
                      background: 'rgba(59, 130, 246, 0.1)',
                      fontStyle: 'italic',
                    }}
                  >
                    + Use &ldquo;{title.trim()}&rdquo; as custom title
                  </div>
                )}
            </div>
          )}
        </div>

        {/* 2. Assign To (with UserAvatar & colored rings) */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #f8fafc)',
              marginBottom: 8,
            }}
          >
            Assign To <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 10 }}>
            {family.map((person) => {
              const isSelected = assignedTo === person.name;
              const pColor = person.color || '#3b82f6';

              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setAssignedTo(person.name)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 8px',
                    borderRadius: '14px',
                    border: isSelected
                      ? `2px solid ${pColor}`
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isSelected
                      ? `${pColor}22`
                      : 'rgba(255, 255, 255, 0.04)',
                    boxShadow: isSelected ? `0 4px 14px ${pColor}35` : 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UserAvatar
                    avatar={person.avatar}
                    name={person.name}
                    color={pColor}
                    size={40}
                    borderWidth={2.5}
                  />
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {person.name}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: pColor,
                        color: '#000',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Points Reward Input with NumberStepper */}
        <div>
          <NumberStepper
            label={isCash ? 'Pocket Money Reward ($)' : 'Points Reward'}
            required
            value={points}
            onChange={(val) => setPoints(String(val))}
            min={0}
            step={isCash ? 0.5 : 1}
            prefix={isCash ? <strong>$</strong> : <i className="fas fa-star" style={{ color: '#fbbf24' }} />}
            presets={isCash ? [0.5, 1, 2, 5] : [1, 2, 5, 10]}
            buttonsPosition="right"
            inputWidth={80}
            helperText={isCash ? 'Pocket money awarded when chore is completed' : 'Points earned when chore is completed'}
          />
        </div>

        {/* 4. Chore Photo / Image Upload (Feature Request) */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #f8fafc)',
              marginBottom: 6,
            }}
          >
            Chore Image / Photo <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span>
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 12,
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {imagePreview ? (
              <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
                <img
                  src={imagePreview}
                  alt="Chore"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Remove image"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                <i className="fas fa-image" />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="chore-modal-file-upload"
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="fas fa-camera"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <Button
                  type="button"
                  variant={stockPickerOpen ? 'primary' : 'outline'}
                  size="sm"
                  icon="fas fa-shapes"
                  onClick={() => setStockPickerOpen((prev) => !prev)}
                >
                  Choose Illustration
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon="fas fa-trash"
                    onClick={() => {
                      handleClearImage();
                      setStockPickerOpen(false);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                Choose a stock illustration or upload a custom photo for this chore
              </div>

              {stockPickerOpen && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
                    gap: 8,
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    marginTop: 10,
                    maxHeight: 190,
                    overflowY: 'auto',
                  }}
                >
                  {STOCK_CHORE_IMAGES.map((item) => (
                    <div
                      key={item.url}
                      onClick={() => {
                        setImageUrl(item.url);
                        setImagePreview(item.url);
                        setImageFile(null);
                        setRemoveImage(false);
                        setStockPickerOpen(false);
                      }}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        padding: 6,
                        borderRadius: 8,
                        border: imageUrl === item.url ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: imageUrl === item.url ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                        transition: 'all 0.15s ease',
                      }}
                      title={item.label}
                    >
                      <img
                        src={item.url}
                        alt={item.label}
                        style={{ width: 36, height: 36, margin: '0 auto 4px', display: 'block', borderRadius: 6 }}
                      />
                      <span style={{ fontSize: '0.68rem', display: 'block', lineHeight: 1.2, color: '#f1f5f9', fontWeight: 600 }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Repeating Chore Toggle & Day Selector */}
        <div
          style={{
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Clickable Header Row */}
          <div
            onClick={() => {
              setIsRepeating((prev) => {
                const next = !prev;
                if (!next) setSelectedDays([]);
                return next;
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: isRepeating ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: isRepeating ? '#60a5fa' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                }}
              >
                <i className="fas fa-rotate" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Repeating Chore
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Resets automatically on chosen days
                </div>
              </div>
            </div>

            {/* Clean toggle switch */}
            <div
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: isRepeating ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                position: 'relative',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 2,
                  left: isRepeating ? 22 : 2,
                  transition: 'left 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>

          {/* Days of week selector pills */}
          {isRepeating && (
            <div
              style={{
                paddingTop: 10,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Repeat Days <span style={{ opacity: 0.6 }}>(leave empty for every day)</span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={handleSelectAllDays}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    All
                  </button>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <button
                    type="button"
                    onClick={handleSelectWeekdays}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Mon–Fri
                  </button>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <button
                    type="button"
                    onClick={handleSelectWeekends}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Weekends
                  </button>
                </div>
              </div>

              {/* Circular Day Pills */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                {DAYS_OF_WEEK.map((d) => {
                  const active = selectedDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: '10px',
                        border: active
                          ? '1.5px solid #38bdf8'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        background: active
                          ? 'rgba(56, 189, 248, 0.25)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: active ? '#ffffff' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                      title={d.short}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 6. Due Date & Time Toggle & Picker */}
        <div
          style={{
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Clickable Header Row */}
          <div
            onClick={() => setHasDueDate((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: hasDueDate ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: hasDueDate ? '#f43f5e' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                }}
              >
                <i className="fas fa-clock" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Due Date &amp; Time
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Marks chore as overdue if not completed in time
                </div>
              </div>
            </div>

            {/* Clean toggle switch */}
            <div
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: hasDueDate ? '#f43f5e' : 'rgba(255, 255, 255, 0.2)',
                position: 'relative',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 2,
                  left: hasDueDate ? 22 : 2,
                  transition: 'left 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>

          {/* Date Picker Input */}
          {hasDueDate && (
            <div style={{ paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <input
                type="datetime-local"
                className="modern-input"
                value={dueDatetime}
                onChange={(e) => setDueDatetime(e.target.value)}
                style={{ width: '100%', height: 42, fontSize: '0.9rem' }}
              />
            </div>
          )}
        </div>

        {/* 7. Time-Based Chore Timer (Feature Request) */}
        <div
          style={{
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Clickable Header Row */}
          <div
            onClick={() => setIsTimeBased((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: isTimeBased ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: isTimeBased ? '#10b981' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                }}
              >
                <i className="fas fa-stopwatch" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Time-Based Chore (Countdown Timer)
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Flips chore card into an interactive countdown timer (e.g. 2m brush teeth, 10m dinner)
                </div>
              </div>
            </div>

            {/* Clean toggle switch */}
            <div
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: isTimeBased ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                position: 'relative',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 2,
                  left: isTimeBased ? 22 : 2,
                  transition: 'left 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>

          {/* Duration Selector with DurationStepper */}
          {isTimeBased && (
            <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <DurationStepper
                label="Timer Duration (Minutes : Seconds)"
                totalSeconds={durationSeconds}
                onChange={(sec) => setDurationSeconds(sec)}
                minSeconds={30}
                stepSeconds={30}
                helperText="Countdown timer duration when this chore is started."
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
