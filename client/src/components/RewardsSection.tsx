import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { Reward, FamilyMember } from '../types';
import { Modal } from './common/Modal';

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

const STANDARD_SUGGESTIONS = [
  'Millhouse Canteen',
  'MiniGolf',
  '1 hour of ipad',
  '1 hour of TV',
  'A Movie',
  'Baking Something Yum',
  'Take Out Dinner',
  'Ice Cream Treat',
  'Gaming Session',
];

function getRewardIconClass(title: string): string {
  const lower = (title || '').toLowerCase();
  if (lower.includes('canteen') || lower.includes('dinner') || lower.includes('treat')) return 'fa-utensils';
  if (lower.includes('golf')) return 'fa-golf-ball';
  if (lower.includes('ipad') || lower.includes('screen') || lower.includes('tablet')) return 'fa-tablet-alt';
  if (lower.includes('tv')) return 'fa-tv';
  if (lower.includes('movie')) return 'fa-film';
  if (lower.includes('bake') || lower.includes('cake') || lower.includes('ice cream')) return 'fa-birthday-cake';
  if (lower.includes('game') || lower.includes('gaming')) return 'fa-gamepad';
  return 'fa-gift';
}

export const RewardsSection: React.FC = () => {
  const { data, refresh, playSound, showToast } = useApp();

  // Accordion state
  const [availableCollapsed, setAvailableCollapsed] = useState(false);

  // Person filter state (null = All Family)
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  // Form fields
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

  // Picker modal for "Everyone" rewards when redeeming without a filtered person
  const [redeemPickerReward, setRedeemPickerReward] = useState<Reward | null>(null);

  // Celebration modal state
  const [celebratingReward, setCelebratingReward] = useState<{ title: string; personName: string } | null>(null);

  if (!data) return null;

  const family: FamilyMember[] = data.family || [];
  const rewards: Reward[] = data.rewards || [];
  const availableRewards = rewards.filter((r) => !r.completed);
  const isCash = data.reward_system === 'cash';

  // Autocomplete unique suggestions from DB + standards
  const allSuggestions = useMemo(() => {
    const set = new Set<string>(STANDARD_SUGGESTIONS);
    rewards.forEach((r) => {
      if (r.title && r.title.trim()) set.add(r.title.trim());
    });
    return Array.from(set);
  }, [rewards]);

  const selectedPerson = selectedPersonId != null ? family.find((p) => p.id === selectedPersonId) || null : null;

  // Filter available rewards by selected person
  const filteredRewards = useMemo(() => {
    if (!selectedPerson) return availableRewards;
    return availableRewards.filter((r) => {
      if (r.assigned_to === 'Everyone' || r.assigned_to === 'All' || !r.assigned_to) return true;
      if (r.assigned_to_id != null && r.assigned_to_id === selectedPerson.id) return true;
      if (r.assigned_to === selectedPerson.name) return true;
      return false;
    });
  }, [availableRewards, selectedPerson]);

  const openAddModal = () => {
    setEditingReward(null);
    setFormTitle('');
    setFormPoints('10');
    setFormAssignedTo(selectedPerson ? selectedPerson.name : 'Everyone');
    setFormIsRecurring(true);
    setFormDescription('');
    setFormStockImageUrl('');
    setFormStockLabel('Choose a Stock Image');
    setStockPickerOpen(false);
    setFormImageUrl('');
    setFormImageFile(null);
    setModalOpen(true);
  };

  const openEditModal = (r: Reward) => {
    setEditingReward(r);
    setFormTitle(r.title);
    setFormPoints(String(r.points_required));
    setFormAssignedTo(r.assigned_to || 'Everyone');
    setFormIsRecurring(r.is_recurring !== false);
    setFormDescription(r.description || '');
    setFormStockImageUrl(r.image_url && r.image_url.startsWith('./static/images/rewards/') ? r.image_url : '');
    setFormStockLabel(
      r.image_url && r.image_url.startsWith('./static/images/rewards/') ? 'Stock Image Selected' : 'Choose a Stock Image'
    );
    setStockPickerOpen(false);
    setFormImageUrl(r.image_url && !r.image_url.startsWith('./static/images/rewards/') ? r.image_url : '');
    setFormImageFile(null);
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setSubmitting(true);
    try {
      const assignedPerson = family.find((p) => p.name === formAssignedTo);
      const isEveryone = formAssignedTo === 'Everyone' || formAssignedTo === 'All';

      if (editingReward) {
        // Edit existing
        await apiPost('edit_reward', {
          reward_id: editingReward.id,
          title: formTitle.trim(),
          points_required: parseFloat(formPoints) || 10,
          assigned_to: formAssignedTo,
          person_id: isEveryone ? null : assignedPerson?.id || null,
          is_recurring: formIsRecurring ? 1 : 0,
          description: formDescription.trim(),
        });

        // Handle image edit if changed
        let chosenImage = editingReward.image_url || '';
        if (formStockImageUrl) {
          chosenImage = formStockImageUrl;
        } else if (formImageUrl.trim()) {
          chosenImage = formImageUrl.trim();
        }
        if (chosenImage !== (editingReward.image_url || '')) {
          await apiPost('edit_reward_image', {
            reward_id: editingReward.id,
            image_url: chosenImage,
          });
        }

        showToast(`Updated reward "${formTitle.trim()}"`);
      } else {
        // Create new
        const fd = new FormData();
        fd.append('title', formTitle.trim());
        fd.append('points_required', String(parseFloat(formPoints) || 10));
        fd.append('assigned_to', formAssignedTo);
        if (!isEveryone && assignedPerson) {
          fd.append('person_id', String(assignedPerson.id));
        }
        fd.append('is_recurring', formIsRecurring ? '1' : '0');
        fd.append('description', formDescription.trim());

        if (formImageFile) {
          fd.append('image_file', formImageFile);
        } else if (formImageUrl.trim()) {
          fd.append('image_url', formImageUrl.trim());
        } else if (formStockImageUrl) {
          fd.append('stock_image_url', formStockImageUrl);
        }

        const res = await apiPost<{ success: boolean; error?: string }>('add_reward', fd);
        if (res.success === false) {
          throw new Error(res.error || 'Failed to add reward');
        }
        showToast(`🎁 Created reward "${formTitle.trim()}"`);
      }

      setModalOpen(false);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save reward', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemReward = async (reward: Reward, targetPerson?: FamilyMember) => {
    const isEveryone = reward.assigned_to === 'Everyone' || reward.assigned_to === 'All' || !reward.assigned_to;

    // Determine who is redeeming
    let personToRedeem = targetPerson;
    if (!personToRedeem) {
      if (selectedPerson) {
        personToRedeem = selectedPerson;
      } else if (!isEveryone) {
        personToRedeem = family.find((p) => p.name === reward.assigned_to);
      }
    }

    // If it's an "Everyone" reward and we don't know who is redeeming, open the picker modal
    if (isEveryone && !personToRedeem) {
      setRedeemPickerReward(reward);
      return;
    }

    if (!personToRedeem) {
      showToast('Could not find family member to redeem', { type: 'error' });
      return;
    }

    const currentPts = (personToRedeem.points || 0) + (personToRedeem.bonus_points || 0);
    const reqPts = Number(reward.points_required || 1);
    if (currentPts < reqPts) {
      showToast(`${personToRedeem.name} needs ${reqPts - currentPts} more points to redeem this!`, { type: 'warning' });
      return;
    }

    try {
      const res = await apiPost<{ success: boolean; error?: string }>('complete_reward', {
        reward_id: reward.id,
        person_id: personToRedeem.id,
        assigned_to_id: personToRedeem.id,
        person_name: personToRedeem.name,
      });

      if (res.success !== false) {
        playSound();
        setRedeemPickerReward(null);
        setCelebratingReward({
          title: reward.title,
          personName: personToRedeem.name,
        });
        await refresh();
      } else {
        showToast(res.error || 'Failed to redeem reward', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Could not redeem reward', { type: 'error' });
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    if (!window.confirm(`Are you sure you want to delete "${reward.title}"?`)) {
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

  return (
    <>
      {/* Autocomplete Datalist */}
      <datalist id="reward-suggestions-datalist">
        {allSuggestions.map((s, idx) => (
          <option key={idx} value={s} />
        ))}
      </datalist>

      {/* Available Rewards Section */}
      <section
        className={`rewards-section collapsible-section${availableCollapsed ? ' collapsed' : ''}`}
        id="rewards-section"
      >
        <div className="rewards-header-row">
          <h2
            className="section-title section-toggle"
            onClick={() => setAvailableCollapsed((p) => !p)}
            style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <i className="fas fa-trophy" style={{ color: '#a78bfa' }} />
            <span>Available Rewards</span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(167,139,250,0.2)',
                color: '#c084fc',
                fontWeight: 700,
              }}
            >
              {filteredRewards.length}
            </span>
            <i className="fas fa-chevron-down section-chevron" />
          </h2>

          <button
            type="button"
            className="btn-primary"
            onClick={openAddModal}
            style={{
              padding: '7px 16px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-plus" /> Add Reward
          </button>
        </div>

        {/* Person Filter Bar */}
        <div
          className="chore-user-filter-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedPersonId(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 16px',
              borderRadius: 999,
              border: selectedPerson === null ? '2px solid #60a5fa' : '1px solid rgba(148,163,184,0.28)',
              background: selectedPerson === null ? 'rgba(59,130,246,0.22)' : 'rgba(15,23,42,0.45)',
              color: selectedPerson === null ? '#93c5fd' : 'var(--cr-text-primary)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <i className="fas fa-users" /> All Family
          </button>

          {family.map((person) => {
            const isSelected = selectedPerson?.id === person.id;
            const pts = (person.points || 0) + (person.bonus_points || 0);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedPersonId(isSelected ? null : person.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 14px 5px 6px',
                  borderRadius: 999,
                  border: isSelected
                    ? `2px solid ${person.color || '#60a5fa'}`
                    : '1px solid rgba(148,163,184,0.28)',
                  background: isSelected
                    ? person.color || 'rgba(59,130,246,0.28)'
                    : 'rgba(15,23,42,0.45)',
                  color: isSelected ? '#0f172a' : 'var(--cr-text-primary)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? '0 3px 12px rgba(0,0,0,0.28)' : 'none',
                }}
              >
                <img
                  src={resolveAvatarUrl(person.avatar)}
                  alt={person.name}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid rgba(0,0,0,0.35)',
                  }}
                />
                <span>{person.name}</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    opacity: 0.85,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: isSelected ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)',
                    color: isSelected ? '#ffffff' : 'var(--cr-text-secondary)',
                  }}
                >
                  {pts} pts
                </span>
              </button>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredRewards.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <i className="fas fa-gift" style={{ fontSize: '2.8em', color: '#666', marginBottom: '0.8rem' }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No rewards available</p>
            <p className="subtitle" style={{ margin: '0 0 14px', fontSize: '0.9rem', color: 'var(--cr-text-secondary)' }}>
              {selectedPerson ? `No rewards created for ${selectedPerson.name} or Everyone yet.` : 'Create some amazing rewards to motivate everyone!'}
            </p>
            <button type="button" className="btn-primary" onClick={openAddModal}>
              <i className="fas fa-plus" /> Add First Reward
            </button>
          </div>
        )}

        {/* Compact Modern Rewards Grid */}
        <div className="rewards-grid-modern">
          {filteredRewards.map((reward) => {
            const isEveryone = reward.assigned_to === 'Everyone' || reward.assigned_to === 'All' || !reward.assigned_to;
            const assignedPerson = !isEveryone ? family.find((p) => p.name === reward.assigned_to) : null;

            // Target person for progress calculation
            const targetPerson = assignedPerson || selectedPerson;
            const currentPts = targetPerson ? (targetPerson.points || 0) + (targetPerson.bonus_points || 0) : 0;
            const reqPts = Number(reward.points_required || 1);
            const rawPercent = reqPts > 0 ? (currentPts / reqPts) * 100 : 0;
            const achievedPercent = Math.min(100, Math.round(rawPercent * 10) / 10);
            const canRedeem = targetPerson ? currentPts >= reqPts : true;

            return (
              <div key={reward.id} className="reward-card-modern">
                {/* Header row: Visual + Title + Points Badge */}
                <div className="reward-card-header">
                  <div className="reward-card-title-group">
                    {reward.image_url ? (
                      <img
                        src={resolveAssetUrl(reward.image_url)}
                        alt={reward.title}
                        className="reward-card-thumb"
                      />
                    ) : (
                      <div className="reward-card-icon-box">
                        <i className={`fas ${getRewardIconClass(reward.title)}`} />
                      </div>
                    )}
                    <h3 className="reward-card-title" title={reward.title}>
                      {reward.title}
                    </h3>
                  </div>

                  <span className={`reward-points-pill${isCash ? ' cash' : ''}`}>
                    {isCash ? (
                      <>
                        <i className="fas fa-money-bill-wave" />
                        <span>${reqPts.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-award" />
                        <span>{reqPts} pts</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Meta row: Assignee pill + Recurring badge */}
                <div className="reward-card-meta">
                  {isEveryone ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#c084fc',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      🌟 Everyone
                    </span>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <img
                        src={resolveAvatarUrl(assignedPerson?.avatar)}
                        alt={reward.assigned_to}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--cr-text-primary)', fontSize: '0.82rem' }}>
                        {reward.assigned_to}
                      </span>
                    </div>
                  )}

                  {reward.is_recurring !== false ? (
                    <span
                      title="Repeatable / recurring reward"
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--cr-text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      🔁 Recurring
                    </span>
                  ) : (
                    <span
                      title="One-time reward"
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--cr-text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      1-time
                    </span>
                  )}
                </div>

                {/* Optional description */}
                {reward.description && (
                  <p className="reward-card-desc" title={reward.description}>
                    {reward.description}
                  </p>
                )}

                {/* Progress bar (if assigned to someone or if a person is filtered) */}
                {targetPerson && (
                  <div>
                    <div className="reward-progress-track">
                      <div className="reward-progress-bar" style={{ width: `${achievedPercent}%` }} />
                    </div>
                    <div className="reward-progress-text">
                      <span>{targetPerson.name}: {currentPts} / {reqPts} pts</span>
                      <span>{achievedPercent}%</span>
                    </div>
                  </div>
                )}

                {/* Actions row: Redeem button + Edit / Delete icons side-by-side */}
                <div className="reward-card-actions-row">
                  <button
                    type="button"
                    className="btn-redeem-modern"
                    onClick={() => handleRedeemReward(reward)}
                    disabled={targetPerson ? !canRedeem : false}
                    title={
                      targetPerson && !canRedeem
                        ? `Not enough points (${currentPts}/${reqPts})`
                        : `Redeem "${reward.title}"`
                    }
                  >
                    <i className="fas fa-check-circle" /> Redeem
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="reward-icon-btn"
                      onClick={() => openEditModal(reward)}
                      title="Edit reward"
                      aria-label="Edit reward"
                    >
                      <i className="fas fa-pencil-alt" />
                    </button>
                    <button
                      type="button"
                      className="reward-icon-btn delete"
                      onClick={() => handleDeleteReward(reward)}
                      title="Delete reward"
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

      {/* Unified Add / Edit Reward Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingReward ? 'Edit Reward' : 'Add New Reward'}
        icon={editingReward ? 'fas fa-pencil-alt' : 'fas fa-gift'}
        maxWidth={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submitting}
              onClick={handleSaveModal}
            >
              {submitting ? 'Saving...' : editingReward ? 'Save Changes' : 'Create Reward'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title with Autocomplete */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cr-text-secondary)' }}>
              Reward Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              list="reward-suggestions-datalist"
              placeholder="e.g. 1 hour of iPad, Movie Night, Ice Cream..."
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              autoFocus
              className="modern-input"
            />
          </div>

          {/* Points & Assignee Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cr-text-secondary)' }}>
                {isCash ? 'Cost ($)' : 'Points Required'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min={isCash ? '0.01' : '1'}
                step={isCash ? '0.01' : '1'}
                value={formPoints}
                onChange={(e) => setFormPoints(e.target.value)}
                required
                className="modern-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cr-text-secondary)' }}>
                Assign To
              </label>
              <select
                value={formAssignedTo}
                onChange={(e) => setFormAssignedTo(e.target.value)}
                className="modern-input"
              >
                <option value="Everyone">🌟 Everyone (All Family)</option>
                {family.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurring Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
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
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--cr-text-secondary)', fontWeight: 400 }}>
                Stays in Available Rewards after redemption so kids can earn it again.
              </span>
            </label>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cr-text-secondary)' }}>
              Description <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <textarea
              placeholder="Add details, rules, or fun notes..."
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="modern-textarea"
            />
          </div>

          {/* Image Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cr-text-secondary)' }}>
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
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFormImageFile(f);
                    if (f) {
                      setFormStockImageUrl('');
                      setFormStockLabel('Choose a Stock Image');
                      setFormImageUrl('');
                    }
                  }}
                />
              </label>
            </div>

            {stockPickerOpen && (
              <div
                className="stock-image-picker"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {STOCK_REWARD_IMAGES.map((item) => (
                  <div
                    key={item.url}
                    className={`stock-image-tile${formStockImageUrl === item.url ? ' selected' : ''}`}
                    onClick={() => {
                      setFormStockImageUrl(item.url);
                      setFormStockLabel(`✓ ${item.label}`);
                      setFormImageUrl('');
                      setFormImageFile(null);
                      setStockPickerOpen(false);
                    }}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: 6,
                      borderRadius: 8,
                      border: formStockImageUrl === item.url ? '2px solid #3b82f6' : '1px solid transparent',
                      background: formStockImageUrl === item.url ? 'rgba(59,130,246,0.2)' : 'transparent',
                    }}
                  >
                    <img src={item.url} alt={item.label} style={{ width: 34, height: 34, margin: '0 auto 4px' }} />
                    <span style={{ fontSize: '0.7rem', display: 'block', lineHeight: 1.2 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Quick Redeem Picker Modal (for "Everyone" rewards when All Family filter is active) */}
      <Modal
        open={redeemPickerReward !== null}
        onClose={() => setRedeemPickerReward(null)}
        title="Redeem Reward"
        icon="fas fa-gift"
        maxWidth={440}
        footer={
          <button type="button" className="btn-cancel" onClick={() => setRedeemPickerReward(null)}>
            Cancel
          </button>
        }
      >
        {redeemPickerReward && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--cr-text-secondary)' }}>
              Who is redeeming <strong>"{redeemPickerReward.title}"</strong> ({redeemPickerReward.points_required} pts)?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {family.map((person) => {
                const pts = (person.points || 0) + (person.bonus_points || 0);
                const req = Number(redeemPickerReward.points_required || 1);
                const hasEnough = pts >= req;
                return (
                  <div
                    key={person.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={resolveAvatarUrl(person.avatar)}
                        alt={person.name}
                        style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{person.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)' }}>
                          {pts} points available
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-redeem-modern"
                      disabled={!hasEnough}
                      onClick={() => handleRedeemReward(redeemPickerReward, person)}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      {hasEnough ? `Redeem (-${req})` : `Need ${req - pts} more`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Celebration Modal */}
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
              {celebratingReward.personName} unlocked "{celebratingReward.title}"!
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
  const { data, refresh, showToast } = useApp();
  const [collapsed, setCollapsed] = useState(true);

  if (!data) return null;
  const family = data.family || [];
  const rewards = data.rewards || [];
  const redeemedRewards = rewards.filter((r) => r.completed);
  const isCash = data.reward_system === 'cash';

  const handleDeleteReward = async (reward: Reward) => {
    if (!window.confirm(`Are you sure you want to delete "${reward.title}" from history?`)) return;
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
        style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <i className="fas fa-trophy" style={{ color: '#a78bfa' }} />
        <span>Redeemed Rewards</span>
        <span
          style={{
            fontSize: '0.8rem',
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(167,139,250,0.2)',
            color: '#c084fc',
            fontWeight: 700,
          }}
        >
          {redeemedRewards.length}
        </span>
        <i className="fas fa-chevron-down section-chevron" />
      </h2>

      {redeemedRewards.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--cr-text-secondary)', fontStyle: 'italic', marginTop: 14 }}>
          This is where your redeemed rewards will be when you redeem them
        </p>
      )}

      <div className="rewards-grid-modern" style={{ marginTop: 14 }}>
        {redeemedRewards.map((reward) => {
          const person = family.find((p) => p.name === reward.assigned_to);
          const reqPts = Number(reward.points_required || 0);
          return (
            <div
              key={reward.id}
              className="reward-card-modern"
              style={{ opacity: 0.75 }}
            >
              <div className="reward-card-header">
                <div className="reward-card-title-group">
                  {reward.image_url ? (
                    <img
                      src={resolveAssetUrl(reward.image_url)}
                      alt={reward.title}
                      className="reward-card-thumb"
                    />
                  ) : (
                    <div className="reward-card-icon-box">
                      <i className={`fas ${getRewardIconClass(reward.title)}`} />
                    </div>
                  )}
                  <h3 className="reward-card-title" title={reward.title}>
                    {reward.title}
                  </h3>
                </div>

                <span className={`reward-points-pill${isCash ? ' cash' : ''}`}>
                  {isCash ? (
                    <>
                      <i className="fas fa-money-bill-wave" />
                      <span>${reqPts.toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-award" />
                      <span>{reqPts} pts</span>
                    </>
                  )}
                </span>
              </div>

              <div className="reward-card-meta">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <img
                    src={resolveAvatarUrl(person?.avatar)}
                    alt={reward.assigned_to}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--cr-text-primary)', fontSize: '0.82rem' }}>
                    {reward.assigned_to || 'Everyone'}
                  </span>
                </div>

                <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 700 }}>
                  <i className="fas fa-check-circle" /> Redeemed
                </span>
              </div>

              <div className="reward-card-actions-row">
                <span style={{ color: 'var(--cr-text-secondary)', fontSize: '0.78rem' }}>
                  {reward.date_completed
                    ? `On ${new Date(reward.date_completed).toLocaleDateString()}`
                    : 'Completed'}
                </span>

                <button
                  type="button"
                  className="reward-icon-btn delete"
                  onClick={() => handleDeleteReward(reward)}
                  title="Delete from history"
                  aria-label="Delete reward"
                >
                  <i className="fas fa-trash-alt" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
