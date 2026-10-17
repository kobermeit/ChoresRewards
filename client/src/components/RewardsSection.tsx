import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { Reward } from '../types';

const INITIAL_REWARD_SUGGESTIONS = [
  'Millhouse Canteen',
  'MiniGolf',
  '1 hour of ipad',
  '1 hour of TV',
  'A Movie',
  'Baking Something Yum',
];

const STOCK_REWARD_IMAGES = [
  { url: './static/images/rewards/reward_takeout.svg', label: 'Take Out Dinner' },
  { url: './static/images/rewards/reward_order_in.svg', label: 'Order In Dinner' },
  { url: './static/images/rewards/reward_shopping.svg', label: 'Shopping Trip' },
  { url: './static/images/rewards/reward_movie.svg', label: 'Movie Night' },
  { url: './static/images/rewards/reward_baking.svg', label: 'Baking Day' },
  { url: './static/images/rewards/reward_minigolf.svg', label: 'Mini Golf' },
  { url: './static/images/rewards/reward_screentime.svg', label: 'Screen Time' },
  { url: './static/images/rewards/reward_tv.svg', label: 'TV Time' },
  { url: './static/images/rewards/reward_icecream.svg', label: 'Ice Cream' },
  { url: './static/images/rewards/reward_gaming.svg', label: 'Gaming Session' },
  { url: './static/images/rewards/reward_swimming.svg', label: 'Swimming' },
  { url: './static/images/rewards/reward_cafe.svg', label: 'Café Treat' },
];

function getRewardIconClass(title: string): string {
  if (title === 'Millhouse Canteen') return 'fa-utensils';
  if (title === 'MiniGolf') return 'fa-golf-ball';
  if (title === '1 hour of ipad') return 'fa-tablet-alt';
  if (title === '1 hour of TV') return 'fa-tv';
  if (title === 'A Movie') return 'fa-film';
  if (title === 'Baking Something Yum') return 'fa-birthday-cake';
  return 'fa-gift';
}

export const RewardsSection: React.FC = () => {
  const { data, refresh, adultMode, playSound, showToast } = useApp();

  // Accordion states
  const [availableCollapsed, setAvailableCollapsed] = useState(false);
  const [createCollapsed, setCreateCollapsed] = useState(true);

  // Suggestions
  const [rewardSuggestions, setRewardSuggestions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rewardSuggestions');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_REWARD_SUGGESTIONS;
  });
  const [showSuggestionInput, setShowSuggestionInput] = useState(false);
  const [newSuggestion, setNewSuggestion] = useState('');
  const [suggestionEditMode, setSuggestionEditMode] = useState(false);

  // Create reward state
  const [title, setTitle] = useState('');
  const [pointsRequired, setPointsRequired] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [description, setDescription] = useState('');
  const [stockImageUrl, setStockImageUrl] = useState('');
  const [stockImageLabel, setStockImageLabel] = useState('Choose a Stock Image');
  const [stockPickerOpen, setStockPickerOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit reward modal state
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  // Redeemed celebration state
  const [celebratingReward, setCelebratingReward] = useState<Reward | null>(null);

  if (!data) return null;

  const family = data.family || [];
  const rewards = data.rewards || [];
  const availableRewards = rewards.filter((r) => !r.completed);
  const isCash = data.reward_system === 'cash';
  const selectedAssignee = assignedTo || family[0]?.name || '';

  const saveSuggestions = (next: string[]) => {
    setRewardSuggestions(next);
    try {
      localStorage.setItem('rewardSuggestions', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!selectedAssignee) {
      showToast('Please add a family member first', { type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('points_required', String(parseFloat(pointsRequired) || 10));
      fd.append('assigned_to', selectedAssignee);
      fd.append('description', description.trim());
      if (imageFile) {
        fd.append('image_file', imageFile);
      } else if (imageUrl.trim()) {
        fd.append('image_url', imageUrl.trim());
      } else if (stockImageUrl) {
        fd.append('stock_image_url', stockImageUrl);
      }

      const res = await apiPost<{ success: boolean; error?: string }>('add_reward', fd);
      if (res.success !== false) {
        setTitle('');
        setPointsRequired('');
        setDescription('');
        setImageUrl('');
        setStockImageUrl('');
        setStockImageLabel('Choose a Stock Image');
        setImageFile(null);
        showToast(`🎁 Created reward "${title.trim()}"`);
        await refresh();
      } else {
        showToast(res.error || 'Failed to add reward', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add reward', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (!adultMode) {
      showToast('Ask an adult to unlock first 🔒', { type: 'warning' });
      return;
    }
    try {
      const res = await apiPost<{ success: boolean; error?: string }>('complete_reward', {
        reward_id: reward.id,
      });
      if (res.success) {
        playSound();
        setCelebratingReward(reward);
        await refresh();
      } else {
        showToast(res.error || 'Not enough points to redeem this reward', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Could not redeem reward', { type: 'error' });
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    if (!adultMode) {
      showToast('Ask an adult to unlock first 🔒', { type: 'warning' });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${reward.title}" for ${reward.assigned_to}?`)) {
      return;
    }
    try {
      await apiPost('delete_reward', { reward_id: reward.id });
      showToast(`Deleted reward "${reward.title}"`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete reward', { type: 'error' });
    }
  };

  const openEditModal = (r: Reward) => {
    setEditingReward(r);
    setEditTitle(r.title);
    setEditPoints(String(r.points_required));
    setEditAssignedTo(r.assigned_to);
    setEditDescription(r.description || '');
    setEditImageUrl(r.image_url || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward) return;
    try {
      await apiPost('edit_reward', {
        reward_id: editingReward.id,
        title: editTitle.trim(),
        points_required: parseFloat(editPoints) || 10,
        assigned_to: editAssignedTo,
        description: editDescription.trim(),
      });
      if (editImageUrl !== (editingReward.image_url || '')) {
        await apiPost('edit_reward_image', {
          reward_id: editingReward.id,
          image_url: editImageUrl.trim(),
        });
      }
      setEditingReward(null);
      showToast('Reward updated');
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update reward', { type: 'error' });
    }
  };

  return (
    <>
      {/* Enhanced Rewards Section */}
      <section
        className={`rewards-section collapsible-section${availableCollapsed ? ' collapsed' : ''}`}
        id="rewards-section"
      >
        <h2
          className="section-title section-toggle"
          onClick={() => setAvailableCollapsed((p) => !p)}
        >
          <i className="fas fa-trophy" style={{ color: '#a78bfa' }} /> <span>Available Rewards</span>
          <i className="fas fa-chevron-down section-chevron" />
        </h2>

        {availableRewards.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-gift" style={{ fontSize: '3em', color: '#666', marginBottom: '1rem' }} />
            <p>No rewards available yet</p>
            <p className="subtitle">Create some amazing rewards below!</p>
          </div>
        )}

        <div className="rewards-grid">
          {availableRewards.map((reward) => {
            const person = family.find((p) => p.name === reward.assigned_to);
            const currentPts = person ? Number((person.points || 0) + (person.bonus_points || 0)) : 0;
            const reqPts = Number(reward.points_required || 1);
            const rawPercent = reqPts > 0 ? (currentPts / reqPts) * 100 : 0;
            const achievedPercent = Math.min(100, Math.round(rawPercent * 10) / 10);
            const leftPercent = Math.max(0, Math.round((100 - achievedPercent) * 10) / 10);

            return (
              <div
                key={reward.id}
                className="reward-card"
                data-reward-id={reward.id}
                data-assigned-to={reward.assigned_to}
                data-title={reward.title}
                data-points={reward.points_required}
              >
                {reward.image_url ? (
                  <div className="reward-image-container" style={{ position: 'relative' }}>
                    <img
                      src={resolveAssetUrl(reward.image_url)}
                      alt={reward.title}
                      className="reward-image"
                      style={{ cursor: 'pointer' }}
                      onClick={() => adultMode && openEditModal(reward)}
                    />
                    <button
                      type="button"
                      className="edit-image-btn admin-only"
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        borderRadius: '50%',
                        padding: 8,
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                      onClick={() => openEditModal(reward)}
                      title="Edit reward"
                    >
                      <i className="fas fa-pencil-alt" style={{ color: '#fff', fontSize: '1.2em' }} />
                    </button>
                    <div className="reward-overlay">
                      <span className="reward-points-badge">
                        {isCash ? (
                          <>
                            <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                            <span className="reward-points-value">${reqPts.toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-award" style={{ color: '#fbbf24' }} />
                            <span className="reward-points-value">{reqPts}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="reward-icon-container" style={{ position: 'relative' }}>
                    <div className="reward-icon-large">
                      <i className={`fas ${getRewardIconClass(reward.title)}`} />
                    </div>
                    <span className="reward-points-badge">
                      {isCash ? (
                        <>
                          <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                          <span className="reward-points-value">${reqPts.toFixed(2)}</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-award" />
                          <span className="reward-points-value">{reqPts}</span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      className="edit-image-btn admin-only"
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        borderRadius: '50%',
                        padding: 8,
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                      onClick={() => openEditModal(reward)}
                      title="Edit reward"
                    >
                      <i className="fas fa-pencil-alt" style={{ color: '#fff', fontSize: '1.2em' }} />
                    </button>
                  </div>
                )}

                <div className="reward-content">
                  <h3 className="reward-title-modern">{reward.title}</h3>
                  <div
                    className="reward-points-badge"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6 }}
                  >
                    {isCash ? (
                      <>
                        <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                        <span className="reward-points-value">${reqPts.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-award" style={{ color: '#fbbf24' }} />
                        <span className="reward-points-value">{reqPts}</span>
                      </>
                    )}
                  </div>
                  {reward.description && <p className="reward-description">{reward.description}</p>}
                  <div className="reward-meta">
                    <div className="reward-assignee">
                      <img
                        src={resolveAvatarUrl(person?.avatar)}
                        alt={reward.assigned_to}
                        className="assignee-avatar"
                        title={reward.assigned_to}
                      />
                      <span className="assignee-name">{reward.assigned_to}</span>
                    </div>
                  </div>

                  {person && (
                    <div className="reward-progress-container">
                      <div className="reward-progress-bar-bg">
                        <div className="reward-progress-bar-fill" style={{ width: `${achievedPercent}%` }} />
                      </div>
                      <div className="reward-progress-label">
                        {achievedPercent}% achieved • {leftPercent}% left
                      </div>
                    </div>
                  )}

                  <div className="reward-actions-modern admin-only">
                    <button
                      type="button"
                      className="btn-redeem"
                      onClick={() => handleRedeemReward(reward)}
                      aria-label="Redeem reward"
                    >
                      <i className="fas fa-check-circle" /> Redeem
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleDeleteReward(reward)}
                      aria-label="Delete reward"
                    >
                      <i className="fas fa-trash-alt" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Create New Reward Section */}
      <section
        className={`add-rewards-modern collapsible-section${createCollapsed ? ' collapsed' : ''} admin-only`}
        id="create-reward-section"
      >
        <h2
          className="section-title section-toggle"
          onClick={() => setCreateCollapsed((p) => !p)}
        >
          <i className="fas fa-trophy" style={{ color: '#a78bfa' }} /> Create New Reward
          <i className="fas fa-chevron-down section-chevron" />
        </h2>

        {/* Suggestions bar */}
        <div className="chore-suggestions-bar">
          <div className="chore-suggestions-header">
            <span className="chore-suggestions-label">Quick Suggestions</span>
            <div className="chore-suggestions-actions">
              <button
                type="button"
                className="btn-suggestion-add"
                title="Add a quick suggestion"
                onClick={() => setShowSuggestionInput((p) => !p)}
              >
                <i className="fas fa-pencil-alt" />
              </button>
              {showSuggestionInput && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Add a quick suggestion..."
                    className="modern-input suggestion-inline-input"
                    value={newSuggestion}
                    onChange={(e) => setNewSuggestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newSuggestion.trim();
                        if (trimmed && !rewardSuggestions.includes(trimmed)) {
                          saveSuggestions([...rewardSuggestions, trimmed]);
                        }
                        setNewSuggestion('');
                        setShowSuggestionInput(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ whiteSpace: 'nowrap', padding: '0.55rem 0.9rem' }}
                    onClick={() => {
                      const trimmed = newSuggestion.trim();
                      if (trimmed && !rewardSuggestions.includes(trimmed)) {
                        saveSuggestions([...rewardSuggestions, trimmed]);
                      }
                      setNewSuggestion('');
                      setShowSuggestionInput(false);
                    }}
                  >
                    <i className="fas fa-plus" /> Add
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.55rem 0.9rem' }}
                onClick={() => setSuggestionEditMode((p) => !p)}
              >
                {suggestionEditMode ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>
          <div className="reward-suggestions">
            {rewardSuggestions.map((s, idx) =>
              suggestionEditMode ? (
                <div key={idx} className="chore-suggestion-edit-item">
                  <input
                    type="text"
                    value={s}
                    className="modern-input"
                    style={{ padding: '4px 8px', fontSize: '0.85rem', width: 120, height: 32 }}
                    onChange={(e) => {
                      const next = [...rewardSuggestions];
                      next[idx] = e.target.value;
                      saveSuggestions(next);
                    }}
                  />
                  <button
                    type="button"
                    className="btn-suggestion-delete"
                    onClick={() => saveSuggestions(rewardSuggestions.filter((_, i) => i !== idx))}
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <button
                  key={idx}
                  type="button"
                  className="chore-suggestion-chip"
                  onClick={() => setTitle(s)}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </div>

        <form onSubmit={handleCreateReward} id="add-reward-form" className="chore-form-card">
          <div className="chore-field-group">
            <label className="chore-field-label" htmlFor="reward-title">
              <i className="fas fa-trophy" style={{ color: '#a78bfa' }} /> Reward Title
            </label>
            <input
              type="text"
              id="reward-title"
              name="title"
              placeholder="e.g., Trip to the Zoo, Movie Night..."
              className="modern-input chore-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="chore-meta-row">
            <div className="chore-field-group">
              <label className="chore-field-label" htmlFor="reward-points">
                {isCash ? (
                  <>
                    <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} /> Cash Required
                  </>
                ) : (
                  <>
                    <i className="fas fa-star" style={{ color: '#fbbf24' }} /> Points Required
                  </>
                )}
              </label>
              <input
                type="number"
                id="reward-points"
                name="points_required"
                placeholder={isCash ? '10.00' : '100'}
                min={isCash ? '0.01' : '1'}
                step={isCash ? '0.01' : '1'}
                className="modern-input"
                value={pointsRequired}
                onChange={(e) => setPointsRequired(e.target.value)}
                required
              />
            </div>

            <div className="chore-field-group">
              <label className="chore-field-label">
                <i className="fas fa-user-circle" /> Assign To
              </label>
              <div className="chore-assign-pills" id="reward-assignee-pills">
                {family.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={`chore-assign-pill reward-assign-pill${selectedAssignee === person.name ? ' selected' : ''}`}
                    onClick={() => setAssignedTo(person.name)}
                  >
                    <span className="pill-avatar">{person.name.slice(0, 1).toUpperCase()}</span>
                    <span className="pill-name">{person.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="chore-field-group">
            <label className="chore-field-label" htmlFor="reward-description">
              <i className="fas fa-align-left" /> Description{' '}
              <span className="chore-days-hint">(optional)</span>
            </label>
            <textarea
              id="reward-description"
              name="description"
              placeholder="Describe this amazing reward..."
              rows={2}
              className="modern-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="chore-field-group reward-image-group">
            <label className="chore-field-label">
              <i className="fas fa-image" /> Reward Image{' '}
              <span className="chore-days-hint">(optional)</span>
            </label>
            <div className="reward-image-options">
              <button
                type="button"
                id="stock-picker-toggle"
                onClick={() => setStockPickerOpen((p) => !p)}
                className={`stock-picker-btn${stockImageUrl ? ' stock-picker-chosen' : ''}`}
              >
                <i className="fas fa-images" />
                <span id="stock-picker-label">{stockImageLabel}</span>
                <i
                  className="fas fa-chevron-down"
                  style={{ transform: stockPickerOpen ? 'rotate(180deg)' : '' }}
                />
              </button>
              <span className="reward-image-or">or</span>
              <input
                type="text"
                id="reward-image"
                name="image_url"
                placeholder="Paste image URL"
                className="modern-input reward-url-input"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setStockImageUrl('');
                  setStockImageLabel('Choose a Stock Image');
                }}
              />
              <span className="reward-image-or">or</span>
              <label className="btn-upload-inline" style={{ cursor: 'pointer' }}>
                <i className="fa-solid fa-upload" /> {imageFile ? imageFile.name : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setImageFile(f);
                    if (f) {
                      setStockImageUrl('');
                      setStockImageLabel('Choose a Stock Image');
                      setImageUrl('');
                    }
                  }}
                />
              </label>
            </div>
            {stockPickerOpen && (
              <div className="stock-image-picker" id="stock-image-picker" style={{ display: 'flex', marginTop: 10 }}>
                {STOCK_REWARD_IMAGES.map((item) => (
                  <div
                    key={item.url}
                    className={`stock-image-tile${stockImageUrl === item.url ? ' selected' : ''}`}
                    onClick={() => {
                      setStockImageUrl(item.url);
                      setStockImageLabel(`✓ ${item.label}`);
                      setImageUrl('');
                      setImageFile(null);
                      setStockPickerOpen(false);
                    }}
                  >
                    <img src={item.url} alt={item.label} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-add-chore">
            <i className="fas fa-plus" /> {submitting ? 'Creating...' : 'Create Reward'}
          </button>
        </form>
      </section>

      {/* Edit Reward Modal */}
      {editingReward && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--cr-modal-overlay)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditingReward(null)}
        >
          <div
            style={{
              background: 'var(--cr-modal-surface)',
              maxWidth: 460,
              width: '100%',
              padding: 24,
              borderRadius: 18,
              color: 'var(--cr-text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>✏️ Edit Reward</h3>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                required
                className="modern-input"
              />
              <select
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                className="modern-input"
              >
                {family.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.5"
                value={editPoints}
                onChange={(e) => setEditPoints(e.target.value)}
                placeholder="Points Required"
                className="modern-input"
              />
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                className="modern-input"
              />
              <input
                type="text"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="Image URL"
                className="modern-input"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingReward(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reward Redeemed Celebration Modal */}
      {celebratingReward && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setCelebratingReward(null)}
        >
          <div
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 28,
              borderRadius: 22,
              textAlign: 'center',
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '2px solid #22c55e',
              color: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3.6rem', marginBottom: 8 }}>🎁🎉🏆</div>
            <h2 style={{ margin: '0 0 8px' }}>Reward Redeemed!</h2>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80' }}>
              {celebratingReward.assigned_to} unlocked "{celebratingReward.title}"!
            </p>
            <button
              type="button"
              className="save-btn"
              onClick={() => setCelebratingReward(null)}
              style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, fontWeight: 800 }}
            >
              Awesome! 🙌
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const RedeemedRewardsSection: React.FC = () => {
  const { data, refresh, adultMode, showToast } = useApp();
  const [collapsed, setCollapsed] = useState(true);

  if (!data) return null;
  const family = data.family || [];
  const rewards = data.rewards || [];
  const redeemedRewards = rewards.filter((r) => r.completed);
  const isCash = data.reward_system === 'cash';

  const handleDeleteReward = async (reward: Reward) => {
    if (!adultMode) {
      showToast('Ask an adult to unlock first 🔒', { type: 'warning' });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${reward.title}"?`)) return;
    try {
      await apiPost('delete_reward', { reward_id: reward.id });
      showToast(`Deleted reward "${reward.title}"`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete reward', { type: 'error' });
    }
  };

  return (
    <section
      className={`completed-rewards collapsible-section${collapsed ? ' collapsed' : ''}`}
      id="redeemed-section"
    >
      <h2
        className="section-title section-toggle"
        onClick={() => setCollapsed((p) => !p)}
      >
        <i className="fas fa-trophy" style={{ color: '#a78bfa' }} /> Redeemed Rewards
        <i className="fas fa-chevron-down section-chevron" />
      </h2>

      {redeemedRewards.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--cr-text-secondary)', fontStyle: 'italic', marginTop: 10 }}>
          This is where your redeemed rewards will be when you redeem them
        </p>
      )}

      <div id="redeemed-rewards-container" className="completed-rewards-container">
        {redeemedRewards.map((reward) => {
          const person = family.find((p) => p.name === reward.assigned_to);
          const reqPts = Number(reward.points_required || 0);
          return (
            <div
              key={reward.id}
              className="reward-card"
              style={{ opacity: 0.7, position: 'relative' }}
              data-reward-id={reward.id}
            >
              {reward.image_url ? (
                <div className="reward-image-container">
                  <img src={resolveAssetUrl(reward.image_url)} alt={reward.title} className="reward-image" />
                  <div className="reward-overlay">
                    <span className="reward-points-badge">
                      {isCash ? (
                        <>
                          <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                          <span className="reward-points-value">${reqPts.toFixed(2)}</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-award" />
                          <span className="reward-points-value">{reqPts}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="reward-icon-container">
                  <div className="reward-icon-large">
                    <i className={`fas ${getRewardIconClass(reward.title)}`} />
                  </div>
                  <span className="reward-points-badge">
                    {isCash ? (
                      <>
                        <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                        <span className="reward-points-value">${reqPts.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-award" />
                        <span className="reward-points-value">{reqPts}</span>
                      </>
                    )}
                  </span>
                </div>
              )}

              <div className="reward-content">
                <h3 className="reward-title-modern">{reward.title}</h3>
                <div
                  className="reward-points-badge"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6 }}
                >
                  {isCash ? (
                    <>
                      <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                      <span className="reward-points-value">${reqPts.toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-award" style={{ color: '#fbbf24' }} />
                      <span className="reward-points-value">{reqPts}</span>
                    </>
                  )}
                </div>
                {reward.description && <p className="reward-description">{reward.description}</p>}
                <div className="reward-meta">
                  <div className="reward-assignee">
                    <img
                      src={resolveAvatarUrl(person?.avatar)}
                      alt={reward.assigned_to}
                      className="assignee-avatar"
                    />
                    <span className="assignee-name">{reward.assigned_to}</span>
                  </div>
                </div>
                <div className="reward-actions-modern" style={{ marginTop: 8 }}>
                  <span className="completed-status" style={{ color: '#6366f1', fontWeight: 600 }}>
                    <i className="fas fa-check-circle" /> Redeemed
                  </span>
                  {reward.date_completed && (
                    <span className="completion-date" style={{ color: '#888', fontSize: '0.95em', marginLeft: 10 }}>
                      Redeemed on: {new Date(reward.date_completed).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => handleDeleteReward(reward)}
                    aria-label="Delete reward"
                    style={{ float: 'right', marginLeft: 'auto' }}
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
