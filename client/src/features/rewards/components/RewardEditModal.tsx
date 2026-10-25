import React, { useState, useEffect, useRef } from 'react';
import { Reward, Person } from '../../../types';
import { apiPost, resolveApiUrl, resolveAssetUrl } from '../../../api';
import { Button, Input, FormGrid, FormField, FormErrorAlert, NumberStepper, AssigneeSelect } from '../../../components/ui';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('Everyone');
  const [formIsRecurring, setFormIsRecurring] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [stockPickerOpen, setStockPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingReward) {
      setFormTitle(editingReward.title);
      setFormPoints(String(editingReward.points_required));
      setFormAssignedTo(editingReward.assigned_to || 'Everyone');
      setFormIsRecurring(editingReward.is_recurring !== false);
      setFormDescription(editingReward.description || '');
      setFormImageUrl(editingReward.image_url || null);
      setImagePreview(editingReward.image_url ? resolveAssetUrl(editingReward.image_url) : null);
      setFormImageFile(null);
      setFormError(null);
    } else {
      setFormTitle('');
      setFormPoints(isCash ? '2' : '10');
      setFormAssignedTo('Everyone');
      setFormIsRecurring(true);
      setFormDescription('');
      setFormImageUrl(null);
      setImagePreview(null);
      setFormImageFile(null);
      setFormError(null);
    }
  }, [editingReward, isCash, open]);

  const handleClearImage = () => {
    setFormImageFile(null);
    setFormImageUrl(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setFormImageFile(file);
    setFormImageUrl(null);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a reward title');
      return;
    }

    const assignedPerson = family.find((p) => p.name === formAssignedTo);
    const isGroup = formAssignedTo === 'Everyone' || formAssignedTo === 'All' || formAssignedTo === 'Kids' || formAssignedTo === 'Parents';

    setSubmitting(true);
    setFormError(null);

    try {
      const payload: Record<string, any> = {
        title: formTitle.trim(),
        points_required: parseFloat(formPoints) || (isCash ? 2 : 10),
        assigned_to_id: isGroup ? null : assignedPerson ? assignedPerson.id : null,
        assigned_to: formAssignedTo,
        is_recurring: formIsRecurring ? 1 : 0,
        description: formDescription.trim(),
        image_url: formImageUrl || null,
      };

      if (editingReward) {
        payload.id = editingReward.id;
      }

      if (formImageFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) formData.append(k, String(v));
        });
        formData.append('photo', formImageFile);

        const res = await fetch(resolveApiUrl(editingReward ? 'update_reward' : 'add_reward'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to save reward');
      } else {
        await apiPost(editingReward ? 'update_reward' : 'add_reward', payload);
      }

      showToast(editingReward ? `Updated "${formTitle.trim()}"` : `Added reward "${formTitle.trim()}"`);
      onSaved();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save reward');
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
      maxWidth="560px"
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

        {/* Reusable Assignee Selector (Kids, Parents, Everyone, or Person) */}
        <FormField colSpan={12}>
          <AssigneeSelect
            label="Assign To"
            value={formAssignedTo}
            onChange={(val) => setFormAssignedTo(val)}
            family={family}
            allowGroups
            helperText="Choose whether this reward is available to everyone, kids only, or a specific person."
          />
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

        {/* Image Picker (ChoreModal layout) */}
        <FormField colSpan={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Reward Image / Photo <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 12,
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* Photo Box & Upload Trigger */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="chore-upload-box"
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 14,
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                  background: imagePreview ? '#0f172a' : 'rgba(255, 255, 255, 0.05)',
                  border: imagePreview
                    ? '2px solid rgba(59, 130, 246, 0.6)'
                    : '2px dashed rgba(255, 255, 255, 0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '6px 4px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
                title={imagePreview ? 'Click to change photo' : 'Click to upload photo'}
              >
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Reward"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 10,
                      }}
                    />
                    <div
                      className="chore-upload-overlay"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.55)',
                        opacity: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: 10,
                        textAlign: 'center',
                      }}
                    >
                      <i className="fas fa-camera" style={{ fontSize: '1.1rem', marginBottom: 2 }} />
                      <span>Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <i className="fas fa-camera" style={{ fontSize: '1.35rem', color: '#94a3b8', marginBottom: 4 }} />
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#cbd5e1',
                        fontWeight: 700,
                        textAlign: 'center',
                        lineHeight: 1.15,
                        width: '100%',
                        display: 'block',
                        padding: '0 4px',
                        boxSizing: 'border-box',
                      }}
                    >
                      Upload Photo
                    </span>
                  </>
                )}
              </div>

              {/* Actions: Choose Photo & Remove */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  icon="fas fa-images"
                  onClick={() => setStockPickerOpen(true)}
                >
                  Choose photo
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="danger"
                    icon="fas fa-trash"
                    onClick={handleClearImage}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <PhotoPickerModal
              open={stockPickerOpen}
              onClose={() => setStockPickerOpen(false)}
              title="Choose Reward Photo"
              stockImages={STOCK_REWARD_IMAGES}
              selectedUrl={formImageUrl || undefined}
              onSelect={(url) => {
                setFormImageUrl(url);
                setImagePreview(resolveAssetUrl(url));
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
