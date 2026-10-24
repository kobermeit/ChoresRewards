import React, { useState, useEffect } from 'react';
import { Reward, Person } from '../../../types';
import { apiPost, resolveApiUrl } from '../../../api';
import { Button, Input, Select, FormGrid, FormField, FormErrorAlert, NumberStepper } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';
import { PhotoPickerModal } from '../../../components/common/PhotoPickerModal';
import { useApp } from '../../../context/AppContext';

const STOCK_REWARD_IMAGES = [
  { url: './static/rewards/ice_cream.png', label: 'Ice Cream Treat' },
  { url: './static/rewards/screen_time.png', label: '1 Hr Screen Time' },
  { url: './static/rewards/pizza_night.png', label: 'Pizza Night' },
  { url: './static/rewards/movie_night.png', label: 'Movie Outing' },
  { url: './static/rewards/sleepover.png', label: 'Sleepover' },
  { url: './static/rewards/stay_up_late.png', label: 'Stay Up 30 Mins Late' },
  { url: './static/rewards/lego_set.png', label: 'New Lego Set' },
  { url: './static/rewards/choose_dinner.png', label: 'Pick Tonight\'s Dinner' },
  { url: './static/rewards/theme_park.png', label: 'Theme Park Trip' },
  { url: './static/rewards/pocket_money.png', label: 'Pocket Money Bonus' },
  { url: './static/rewards/new_book.png', label: 'New Book / Comic' },
  { url: './static/rewards/bake_cookies.png', label: 'Bake Cookies' },
  { url: './static/rewards/arcade.png', label: 'Arcade Trip' },
  { url: './static/rewards/board_game.png', label: 'Family Board Game' },
];

export interface RewardEditModalProps {
  open: boolean;
  editingReward: Reward | null;
  family: Person[];
  isCash: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RewardEditModal: React.FC<RewardEditModalProps> = ({
  open,
  editingReward,
  family,
  isCash,
  onClose,
  onSaved,
}) => {
  const { showToast } = useApp();
  const [formTitle, setFormTitle] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('Everyone');
  const [formIsRecurring, setFormIsRecurring] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formStockImageUrl, setFormStockImageUrl] = useState('');
  const [formStockLabel, setFormStockLabel] = useState('Choose a Stock Image');
  const [stockPickerOpen, setStockPickerOpen] = useState(false);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingReward) {
      setFormTitle(editingReward.title);
      setFormPoints(String(editingReward.points_required));
      setFormAssignedTo(editingReward.assigned_to || 'Everyone');
      setFormIsRecurring(editingReward.is_recurring !== false);
      setFormDescription(editingReward.description || '');
      setFormImageUrl(editingReward.image_url || '');
      setFormStockImageUrl(editingReward.image_url || '');
      setFormStockLabel(editingReward.image_url ? 'Custom / Chosen Image' : 'Choose a Stock Image');
      setFormImageFile(null);
      setFormError(null);
    } else {
      setFormTitle('');
      setFormPoints(isCash ? '2' : '10');
      setFormAssignedTo('Everyone');
      setFormIsRecurring(true);
      setFormDescription('');
      setFormImageUrl('');
      setFormStockImageUrl('');
      setFormStockLabel('Choose a Stock Image');
      setFormImageFile(null);
      setFormError(null);
    }
  }, [editingReward, isCash, open]);

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a reward title');
      return;
    }

    const assignedPerson = family.find((p) => p.name === formAssignedTo);
    const isEveryone = formAssignedTo === 'Everyone' || formAssignedTo === 'All';

    setSubmitting(true);
    setFormError(null);

    try {
      const payload: Record<string, any> = {
        title: formTitle.trim(),
        points_required: parseFloat(formPoints) || (isCash ? 2 : 10),
        assigned_to_id: isEveryone ? null : assignedPerson ? assignedPerson.id : null,
        assigned_to: isEveryone ? 'Everyone' : formAssignedTo,
        is_recurring: formIsRecurring,
        description: formDescription.trim() || null,
        image_url: formStockImageUrl || formImageUrl || null,
      };

      if (editingReward) {
        payload.reward_id = editingReward.id;
      }

      if (formImageFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        fd.append('image', formImageFile);

        const res = await fetch(resolveApiUrl(editingReward ? 'edit_reward' : 'add_reward'), {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to save reward');
      } else {
        const endpoint = editingReward ? 'edit_reward' : 'add_reward';
        const res = await apiPost<{ success: boolean; error?: string }>(endpoint, payload);
        if (!res.success) throw new Error(res.error || 'Failed to save reward');
      }

      showToast(editingReward ? `Updated reward "${formTitle.trim()}"` : `Created reward "${formTitle.trim()}"!`);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to save reward';
      setFormError(msg);
      showToast(msg, { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingReward ? 'Edit Reward' : 'Add New Reward'}
      icon={editingReward ? 'fas fa-pencil-alt' : 'fas fa-gift'}
      maxWidth={620}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            isLoading={submitting}
            onClick={handleSaveModal}
          >
            {submitting ? 'Saving...' : editingReward ? 'Save Changes' : 'Create Reward'}
          </Button>
        </div>
      }
    >
      <FormGrid onSubmit={handleSaveModal}>
        <FormField colSpan={12}>
          <FormErrorAlert error={formError} onDismiss={() => setFormError(null)} />
        </FormField>

        {/* Title */}
        <FormField colSpan={12}>
          <Input
            label="Reward Title"
            type="text"
            placeholder="e.g. 1 hour of iPad, Movie Night, Ice Cream..."
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
            autoFocus
          />
        </FormField>

        {/* Assignee Selection */}
        <FormField colSpan={12}>
          <Select
            label="Assign To"
            value={formAssignedTo}
            onChange={(e) => setFormAssignedTo(e.target.value)}
          >
            <option value="Everyone">🌟 Everyone (All Family)</option>
            {family.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>

        {/* Points / Cost Stepper */}
        <FormField colSpan={12}>
          <NumberStepper
            label={isCash ? 'Cost ($)' : 'Points Required'}
            required
            value={formPoints}
            onChange={(val) => setFormPoints(String(val))}
            min={isCash ? 0.5 : 1}
            step={isCash ? 0.5 : 1}
            prefix={isCash ? <strong>$</strong> : <i className="fas fa-star" style={{ color: '#fbbf24' }} />}
            presets={isCash ? [1, 2, 5, 10, 20] : [5, 10, 20, 50, 100]}
            buttonsPosition="right"
            inputWidth={80}
            helperText={isCash ? 'Pocket money required to redeem this reward' : 'Points required to redeem this reward'}
          />
        </FormField>

        {/* Recurring Toggle */}
        <FormField colSpan={12}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <input
              type="checkbox"
              id="form-recurring-toggle"
              checked={formIsRecurring}
              onChange={(e) => setFormIsRecurring(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <label
              htmlFor="form-recurring-toggle"
              style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, userSelect: 'none' }}
            >
              Repeatable / Recurring Reward
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                Stays in Available Rewards after redemption so kids can earn it again.
              </span>
            </label>
          </div>
        </FormField>

        {/* Description */}
        <FormField colSpan={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Description <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <textarea
              placeholder="Add details, rules, or fun notes..."
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="cr-textarea"
              style={{
                width: '100%',
                borderRadius: 'var(--input-radius)',
                background: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </FormField>

        {/* Image Picker */}
        <FormField colSpan={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Reward Image <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStockPickerOpen((p) => !p)}
                className={`stock-picker-btn${formStockImageUrl ? ' stock-picker-chosen' : ''}`}
                style={{ flex: 1, minWidth: 160 }}
              >
                <i className="fas fa-images" />
                <span>{formStockLabel}</span>
                <i className="fas fa-chevron-down" style={{ transform: stockPickerOpen ? 'rotate(180deg)' : '' }} />
              </button>

              <label className="btn-upload-inline" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <i className="fa-solid fa-upload" /> {formImageFile ? formImageFile.name : 'Upload File'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    if (files.length === 1) {
                      setFormImageFile(files[0]);
                      setFormStockImageUrl('');
                      setFormStockLabel('Custom Upload');
                      setFormImageUrl('');
                    } else {
                      try {
                        setSubmitting(true);
                        const formData = new FormData();
                        for (let i = 0; i < files.length; i++) {
                          formData.append('files', files[i]);
                        }
                        const res = await fetch(resolveApiUrl('media/bulk_upload'), {
                          method: 'POST',
                          body: formData,
                          credentials: 'include',
                        });
                        if (res.ok) {
                          const json = await res.json();
                          if (json.success && json.files?.length > 0) {
                            const primary = json.files[0];
                            setFormImageUrl(primary.url);
                            setFormStockImageUrl(primary.url);
                            setFormStockLabel(`✓ ${primary.originalname}`);
                            setFormImageFile(null);
                            showToast(`Uploaded ${json.files.length} photos to your library!`);
                          }
                        }
                      } catch {
                        showToast('Error uploading photos');
                      } finally {
                        setSubmitting(false);
                      }
                    }
                  }}
                />
              </label>
            </div>

            <PhotoPickerModal
              open={stockPickerOpen}
              onClose={() => setStockPickerOpen(false)}
              title="Choose Reward Photo"
              stockImages={STOCK_REWARD_IMAGES}
              selectedUrl={formStockImageUrl || formImageUrl || undefined}
              onSelect={(url, label) => {
                setFormStockImageUrl(url);
                setFormImageUrl(url);
                setFormStockLabel(label ? `✓ ${label}` : 'Selected Photo');
                setFormImageFile(null);
              }}
            />
          </div>
        </FormField>
      </FormGrid>
    </Modal>
  );
};

export default RewardEditModal;
