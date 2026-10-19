import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost, resolveAssetUrl, resolveAvatarUrl, resolveApiUrl } from '../api';
import { Reward, FamilyMember } from '../types';
import { Modal } from './common/Modal';
import { PhotoPickerModal } from './common/PhotoPickerModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { FormErrorAlert } from './FormErrorAlert';
import { FallbackImage } from './common/FallbackImage';
import { Button, IconButton, PillButton, Input, Select, Badge, ResponsiveGrid, FormGrid, FormField, PageContainer, UserAvatar, NumberStepper } from './ui';

const STOCK_REWARD_IMAGES = [
  { url: './static/images/rewards/reward_bike_ride.jpg', label: 'Outdoor Bike / Park Ride' },
  { url: './static/images/rewards/reward_reading.jpg', label: 'Cozy Reading Time' },
  { url: './static/images/rewards/reward_crafts.jpg', label: 'Arts & Crafts Fun' },
  { url: './static/images/rewards/reward_building_blocks.jpg', label: 'Building Blocks & LEGO' },
  { url: './static/images/rewards/reward_music_session.jpg', label: 'Music Jam Session' },
  { url: './static/images/rewards/reward_bubble_bath.jpg', label: 'Fun Bubble Bath with Toys' },
  { url: './static/images/rewards/reward_quiet_time.jpg', label: 'Quiet Time / Chill Session' },
  { url: './static/images/rewards/reward_screentime.svg', label: '1 Hour Tablet / Screen Time' },
  { url: './static/images/rewards/reward_tv.svg', label: 'Pick Tonight TV Show' },
  { url: './static/images/rewards/reward_movie.svg', label: 'Movie Night' },
  { url: './static/images/rewards/reward_gaming.svg', label: 'Gaming Session' },
  { url: './static/images/rewards/reward_icecream.svg', label: 'Ice Cream Treat' },
  { url: './static/images/rewards/reward_takeout.svg', label: 'Take Out Dinner' },
  { url: './static/images/rewards/reward_baking.svg', label: 'Baking Day Together' },
  { url: './static/images/rewards/reward_shopping.svg', label: 'Shopping Trip / Toy Pick' },
  { url: './static/images/rewards/reward_minigolf.svg', label: 'Mini Golf' },
  { url: './static/images/rewards/reward_swimming.svg', label: 'Swimming / Pool Trip' },
  { url: './static/images/rewards/reward_cafe.svg', label: 'Café Treat & Hot Cocoa' },
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

export interface RewardsSectionProps {
  isStandalonePage?: boolean;
}

export const RewardsSection: React.FC<RewardsSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, playSound, showToast, confirm, activeUser, isParent, isChild } = useApp();

  // Accordion state
  const [availableCollapsed, setAvailableCollapsed] = useState(false);

  // Person filter state (null = All Family)
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  useEffect(() => {
    if (isChild && activeUser) {
      setSelectedPersonId(activeUser.id);
    }
  }, [isChild, activeUser?.id]);

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
  const [formError, setFormError] = useState<string | null>(null);

  // Picker modal for "Everyone" rewards when redeeming without a filtered person
  const [redeemPickerReward, setRedeemPickerReward] = useState<Reward | null>(null);

  // Celebration modal state
  const [celebratingReward, setCelebratingReward] = useState<{ title: string; personName: string } | null>(null);

  useBodyScrollLock(Boolean(modalOpen || redeemPickerReward || celebratingReward));

  if (!data) return null;

  const family: FamilyMember[] = (data.family || []).filter(
    (p) => p.role !== 'family' && p.name.toLowerCase() !== 'family'
  );
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
    setFormError(null);
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
    setFormError(null);
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

    setFormError(null);
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

        await apiPost('add_reward', fd);
        showToast(`🎁 Created reward "${formTitle.trim()}"`);
      }

      setModalOpen(false);
      await refresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to save reward';
      setFormError(msg);
      showToast(msg, { type: 'error' });
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
    const ok = await confirm({
      title: 'Delete Reward?',
      message: `Are you sure you want to delete "${reward.title}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
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
      <PageContainer
        title="Available Rewards"
        icon="fas fa-trophy"
        iconClass="section-icon-rewards"
        badge={filteredRewards.length}
        boxed={!isStandalonePage}
        actions={
          isParent ? (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddModal}
            >
              <i className="fas fa-plus" /> Add Reward
            </Button>
          ) : undefined
        }
        toolbar={
          <div
            className="chore-user-filter-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              flexWrap: 'wrap',
              gap: 8,
              padding: '2px 0',
            }}
          >
            <PillButton
              variant={selectedPerson === null ? 'primary' : 'secondary'}
              onClick={() => setSelectedPersonId(null)}
              icon="fas fa-users"
              style={{
                border: selectedPerson === null ? '2px solid #60a5fa' : '1px solid rgba(148,163,184,0.28)',
                fontWeight: 800,
                fontSize: '0.88rem',
              }}
            >
              All Family
            </PillButton>

            {family.map((person) => {
              const isSelected = selectedPerson?.id === person.id;
              const pts = (person.points || 0) + (person.bonus_points || 0);
              return (
                <PillButton
                  key={person.id}
                  onClick={() => setSelectedPersonId(isSelected ? null : person.id)}
                  style={{
                    padding: '5px 14px 5px 6px',
                    border: isSelected
                      ? `2px solid ${person.color || '#60a5fa'}`
                      : '1px solid rgba(148,163,184,0.28)',
                    background: isSelected
                      ? person.color || 'rgba(59,130,246,0.28)'
                      : 'rgba(15,23,42,0.45)',
                    color: isSelected ? '#0f172a' : 'var(--cr-text-primary)',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    boxShadow: isSelected ? '0 3px 12px rgba(0,0,0,0.28)' : 'none',
                  }}
                >
                  <UserAvatar
                    src={resolveAvatarUrl(person.avatar)}
                    name={person.name}
                    color={person.color}
                    size={24}
                  />
                  <span>{person.name}</span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      opacity: 0.85,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-pill)',
                      background: isSelected ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)',
                      color: isSelected ? '#ffffff' : 'var(--cr-text-secondary)',
                    }}
                  >
                    {pts} pts
                  </span>
                </PillButton>
              );
            })}
          </div>
        }
      >

        {/* Empty State */}
        {filteredRewards.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <i className="fas fa-gift" style={{ fontSize: '2.8em', color: '#666', marginBottom: '0.8rem' }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No rewards available</p>
            <p className="subtitle" style={{ margin: '0 0 14px', fontSize: '0.9rem', color: 'var(--cr-text-secondary)' }}>
              {selectedPerson ? `No rewards created for ${selectedPerson.name} or Everyone yet.` : 'Create some amazing rewards to motivate everyone!'}
            </p>
            {isParent && (
              <Button variant="primary" icon="fas fa-plus" onClick={openAddModal}>
                Add First Reward
              </Button>
            )}
          </div>
        )}

        {/* Netflix / Amazon Experience Rewards Grid */}
        <ResponsiveGrid className="rewards-grid-modern" minColWidth="260px">
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
              <div
                key={reward.id}
                className="reward-card-modern"
                style={{
                  background: 'linear-gradient(145deg, #1e293b, #111827)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Hero Visual Banner (Matching Chore Card Style) */}
                <div
                  style={{
                    height: 140,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'radial-gradient(circle at 50% 35%, rgba(59, 130, 246, 0.22) 0%, #0f172a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {reward.image_url ? (
                    <FallbackImage
                      src={resolveAssetUrl(reward.image_url)}
                      alt={reward.title}
                      className="reward-hero-img"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      fallbackIcon={getRewardIconClass(reward.title)}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      <i className={`fas ${getRewardIconClass(reward.title)}`} style={{ fontSize: '3rem', opacity: 0.6 }} />
                    </div>
                  )}

                  {/* Gradient shadow overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.25) 50%, transparent 100%)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Points Currency Floating Pill */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'rgba(0, 0, 0, 0.8)',
                      backdropFilter: 'blur(8px)',
                      border: `1.5px solid ${isCash ? '#4ade80' : '#fbbf24'}`,
                      color: isCash ? '#4ade80' : '#fbbf24',
                      padding: '4px 10px',
                      borderRadius: 10,
                      fontWeight: 900,
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                    title="Required Currency"
                  >
                    {isCash ? (
                      <>
                        <i className="fas fa-money-bill-wave" />
                        <span>${reqPts.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <span>⭐</span>
                        <span>{reqPts} pts</span>
                      </>
                    )}
                  </div>

                  {/* Assignee Badge in Hero */}
                  <div style={{ position: 'absolute', top: 10, left: 10 }}>
                    {isEveryone ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: 'rgba(168, 85, 247, 0.85)',
                          backdropFilter: 'blur(6px)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        🌟 Everyone
                      </span>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'rgba(0, 0, 0, 0.75)',
                          backdropFilter: 'blur(6px)',
                          padding: '3px 8px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.2)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        <img
                          src={resolveAvatarUrl(assignedPerson?.avatar)}
                          alt={reward.assigned_to}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                        <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.78rem' }}>
                          {reward.assigned_to}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color: '#f8fafc',
                          lineHeight: 1.3,
                        }}
                        title={reward.title}
                      >
                        {reward.title}
                      </h3>
                      {reward.is_recurring !== false ? (
                        <span
                          title="Repeatable / recurring reward"
                          style={{
                            fontSize: '0.72rem',
                            color: '#94a3b8',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 6px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🔁 Recurring
                        </span>
                      ) : (
                        <span
                          title="One-time reward"
                          style={{
                            fontSize: '0.72rem',
                            color: '#94a3b8',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 6px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          1-time
                        </span>
                      )}
                    </div>

                    {/* Optional description */}
                    {reward.description && (
                      <p
                        style={{
                          margin: '4px 0 8px',
                          fontSize: '0.82rem',
                          color: 'rgba(255,255,255,0.65)',
                          lineHeight: 1.4,
                        }}
                        title={reward.description}
                      >
                        {reward.description}
                      </p>
                    )}

                    {/* Progress bar (if targetPerson) */}
                    {targetPerson && (
                      <div style={{ margin: '8px 0 4px' }}>
                        <div className="reward-progress-track" style={{ height: 6, borderRadius: 3 }}>
                          <div className="reward-progress-bar" style={{ width: `${achievedPercent}%` }} />
                        </div>
                        <div className="reward-progress-text" style={{ fontSize: '0.74rem', marginTop: 3 }}>
                          <span>{targetPerson.name}: {currentPts} / {reqPts} pts</span>
                          <span>{achievedPercent}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions row: Redeem button + Edit / Delete icons side-by-side */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <Button
                      variant={targetPerson && !canRedeem ? 'secondary' : 'success'}
                      size="sm"
                      icon="fas fa-check"
                      onClick={() => handleRedeemReward(reward)}
                      disabled={targetPerson ? !canRedeem : false}
                      style={{
                        flex: 1,
                        cursor: targetPerson && !canRedeem ? 'not-allowed' : 'pointer',
                      }}
                      title={
                        targetPerson && !canRedeem
                          ? `Not enough points (${currentPts}/${reqPts})`
                          : `Redeem "${reward.title}"`
                      }
                    >
                      Redeem
                    </Button>

                    {isParent && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon="fas fa-pencil-alt"
                          aria-label="Edit reward"
                          title="Edit reward"
                          onClick={() => openEditModal(reward)}
                        />
                        <IconButton
                          size="sm"
                          variant="danger"
                          icon="fas fa-trash-alt"
                          aria-label="Delete reward"
                          title="Delete reward"
                          onClick={() => handleDeleteReward(reward)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </ResponsiveGrid>
      </PageContainer>

      {/* Unified Add / Edit Reward Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingReward ? 'Edit Reward' : 'Add New Reward'}
        icon={editingReward ? 'fas fa-pencil-alt' : 'fas fa-gift'}
        maxWidth={620}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
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

          {/* Title with Autocomplete */}
          <FormField colSpan={12}>
            <Input
              label="Reward Title"
              type="text"
              list="reward-suggestions-datalist"
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

      {/* Quick Redeem Picker Modal (for "Everyone" rewards when All Family filter is active) */}
      <Modal
        open={redeemPickerReward !== null}
        onClose={() => setRedeemPickerReward(null)}
        title="Redeem Reward"
        icon="fas fa-gift"
        maxWidth={440}
        footer={
          <Button variant="secondary" onClick={() => setRedeemPickerReward(null)}>
            Cancel
          </Button>
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
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                        }}
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
              borderRadius: 'var(--modal-radius)',
              textAlign: 'center',
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '2px solid var(--color-success)',
              color: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3.6rem', marginBottom: 8 }}>🎁🎉🏆</div>
            <h2 style={{ margin: '0 0 8px' }}>Reward Redeemed!</h2>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80' }}>
              {celebratingReward.personName} unlocked "{celebratingReward.title}"!
            </p>
            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setCelebratingReward(null)}
              >
                Awesome! 🙌
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export interface RedeemedRewardsSectionProps {
  isStandalonePage?: boolean;
}

export const RedeemedRewardsSection: React.FC<RedeemedRewardsSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, showToast, confirm, isParent } = useApp();
  const [collapsed, setCollapsed] = useState(true);

  if (!data) return null;
  const family = data.family || [];
  const rewards = data.rewards || [];
  const redeemedRewards = rewards.filter((r) => r.completed);
  const isCash = data.reward_system === 'cash';

  const handleDeleteReward = async (reward: Reward) => {
    const ok = await confirm({
      title: 'Delete from History?',
      message: `Are you sure you want to delete "${reward.title}" from redemption history?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiPost('delete_reward', { reward_id: reward.id });
      showToast(`Deleted reward "${reward.title}"`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete reward', { type: 'error' });
    }
  };

  return (
    <PageContainer
      title="Redeemed Rewards"
      icon="fas fa-medal"
      iconClass="section-icon-rewards"
      badge={redeemedRewards.length}
      boxed={!isStandalonePage}
    >

      {redeemedRewards.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--cr-text-secondary)', fontStyle: 'italic', marginTop: 14 }}>
          This is where your redeemed rewards will be when you redeem them
        </p>
      )}

      <div className="rewards-grid-modern" style={{ marginTop: 14 }}>
        {redeemedRewards.map((reward) => {
          const person = family.find((p) => p.name === reward.assigned_to);
          const reqPts = Number(reward.points_required || 0);
          const isEveryone = !reward.assigned_to || reward.assigned_to.toLowerCase() === 'everyone';
          return (
            <div
              key={reward.id}
              className="reward-card-modern"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: 'var(--card-radius, 16px)',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                position: 'relative',
              }}
            >
              {/* Hero Image / Banner (Exact Match to Available Rewards Hero Banner) */}
              <div
                style={{
                  height: 140,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'radial-gradient(circle at 50% 35%, rgba(34, 197, 94, 0.22) 0%, #0f172a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {reward.image_url ? (
                  <FallbackImage
                    src={resolveAssetUrl(reward.image_url)}
                    alt={reward.title}
                    className="reward-hero-img"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.9,
                    }}
                    fallbackIcon={getRewardIconClass(reward.title)}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    <i className={`fas ${getRewardIconClass(reward.title)}`} style={{ fontSize: '3rem', opacity: 0.6, color: '#86efac' }} />
                  </div>
                )}

                {/* Hero Gradient Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.25) 50%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Floating Top-Right "✓ Redeemed" Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'rgba(22, 163, 74, 0.92)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid #86efac',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: 10,
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                  title="Reward has been redeemed"
                >
                  <i className="fas fa-check-circle" />
                  <span>Redeemed</span>
                </div>

                {/* Floating Top-Left Assignee Badge */}
                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                  {isEveryone ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: 'rgba(168, 85, 247, 0.85)',
                        backdropFilter: 'blur(6px)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                    >
                      🌟 Everyone
                    </span>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(6px)',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                    >
                      <img
                        src={resolveAvatarUrl(person?.avatar)}
                        alt={reward.assigned_to}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                      <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.78rem' }}>
                        {reward.assigned_to}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body (Matching Available Rewards) */}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        lineHeight: 1.3,
                      }}
                      title={reward.title}
                    >
                      {reward.title}
                    </h3>

                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: '#4ade80',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isCash ? `$${reqPts.toFixed(2)}` : `⭐ ${reqPts} pts`}
                    </span>
                  </div>

                  {reward.description && (
                    <p
                      style={{
                        margin: '4px 0 8px',
                        fontSize: '0.82rem',
                        color: 'rgba(255,255,255,0.65)',
                        lineHeight: 1.4,
                      }}
                      title={reward.description}
                    >
                      {reward.description}
                    </p>
                  )}
                </div>

                {/* Actions row: Date on left + Delete icon on right */}
                <div className="reward-card-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'var(--cr-text-secondary)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <i className="fas fa-calendar-check" style={{ color: '#4ade80' }} />
                    {reward.date_completed
                      ? `Redeemed ${new Date(reward.date_completed).toLocaleDateString()}`
                      : 'Completed'}
                  </span>

                  {isParent && (
                    <IconButton
                      size="sm"
                      variant="danger"
                      icon="fas fa-trash-alt"
                      onClick={() => handleDeleteReward(reward)}
                      title="Delete from history"
                      aria-label="Delete reward"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
};
