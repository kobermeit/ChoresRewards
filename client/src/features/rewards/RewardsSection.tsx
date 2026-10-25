import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Reward, Person } from '../../types';
import { apiPost, resolveAssetUrl, resolveAvatarUrl } from '../../api';
import { PageContainer, Button, PillButton, ResponsiveGrid, UserAvatar, Badge } from '../../components/ui';
import { RewardCard } from './components/RewardCard';
import { RewardEditModal } from './components/RewardEditModal';
import { ClaimRewardModal } from './components/ClaimRewardModal';
import { useNavigation } from '../../hooks/useSettings';

export interface RewardsSectionProps {
  isStandalonePage?: boolean;
}

export const RewardsSection: React.FC<RewardsSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, playSound, showToast, confirm, isParent } = useApp();
  const { activeView } = useNavigation();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [showRedeemed, setShowRedeemed] = useState(() => activeView === 'redeemed');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [initialImportUrl, setInitialImportUrl] = useState<string | null>(null);
  const [redeemPickerReward, setRedeemPickerReward] = useState<Reward | null>(null);
  const [celebratingReward, setCelebratingReward] = useState<{ title: string; personName: string } | null>(null);
  const [syncingRewardId, setSyncingRewardId] = useState<number | null>(null);

  React.useEffect(() => {
    if (activeView === 'redeemed') {
      setShowRedeemed(true);
    }
  }, [activeView]);

  if (!data) return null;

  const family: Person[] = (data.family || []).filter((p) => p.role !== 'family');
  const rewards: Reward[] = data.rewards || [];
  const availableRewards = rewards.filter((r) => !r.completed);
  const redeemedRewards = rewards.filter((r) => r.completed);
  const isCash = data.reward_system === 'cash';

  const selectedPerson = selectedPersonId != null ? family.find((p) => p.id === selectedPersonId) || null : null;

  const isGroupEligible = (assignedTo: string | undefined, person: Person | null) => {
    if (!person) return true;
    const l = (assignedTo || 'everyone').toLowerCase();
    if (l === 'everyone' || l === 'all') return true;
    if (l === 'kids' && person.role === 'child') return true;
    if ((l === 'parents' || l === 'adults') && person.role === 'parent') return true;
    return assignedTo === person.name;
  };

  const filteredAvailableRewards = useMemo(() => {
    if (!selectedPerson) return availableRewards;
    return availableRewards.filter((r) => isGroupEligible(r.assigned_to, selectedPerson));
  }, [availableRewards, selectedPerson]);

  const filteredRedeemedRewards = useMemo(() => {
    if (!selectedPerson) return redeemedRewards;
    return redeemedRewards.filter((r) => isGroupEligible(r.assigned_to, selectedPerson));
  }, [redeemedRewards, selectedPerson]);

  const openAddModal = async () => {
    let urlFromClipboard: string | null = null;
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const trimmed = (text || '').trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          const lower = trimmed.toLowerCase();
          const isRetailer =
            lower.includes('kmart.') ||
            lower.includes('amazon.') ||
            lower.includes('target.') ||
            lower.includes('bigw.') ||
            lower.includes('lego.') ||
            lower.includes('/product') ||
            lower.includes('/dp/') ||
            lower.includes('/p/');
          if (isRetailer) {
            urlFromClipboard = trimmed;
          }
        }
      }
    } catch {
      // Ignore clipboard permission blocks
    }

    setEditingReward(null);
    setInitialImportUrl(urlFromClipboard);
    setModalOpen(true);
  };

  const openEditModal = (r: Reward) => {
    setEditingReward(r);
    setInitialImportUrl(null);
    setModalOpen(true);
  };

  const handleRedeemReward = async (reward: Reward, targetPerson?: Person) => {
    const l = (reward.assigned_to || 'everyone').toLowerCase();
    const isGroup = l === 'everyone' || l === 'all' || l === 'kids' || l === 'parents' || l === 'adults';
    const personToRedeem = targetPerson || (isGroup ? selectedPerson : family.find((p) => p.name === reward.assigned_to));

    if (isGroup && !personToRedeem) {
      setRedeemPickerReward(reward);
      return;
    }

    if (!personToRedeem) {
      showToast('No eligible person found to redeem this reward', { type: 'error' });
      return;
    }

    const currentPts = (personToRedeem.points || 0) + (personToRedeem.bonus_points || 0);
    const reqPts = Number(reward.points_required || 1);

    if (currentPts < reqPts) {
      showToast(`${personToRedeem.name} doesn't have enough points (${currentPts}/${reqPts})`, { type: 'error' });
      return;
    }

    try {
      const res = await apiPost<{ success: boolean; error?: string }>('complete_reward', {
        reward_id: reward.id,
        person_id: personToRedeem.id,
      });

      if (!res.success) {
        showToast(res.error || 'Failed to redeem reward', { type: 'error' });
        return;
      }

      setRedeemPickerReward(null);
      playSound('fanfare');
      setCelebratingReward({ title: reward.title, personName: personToRedeem.name });
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to redeem reward', { type: 'error' });
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    const ok = await confirm({
      title: 'Delete Reward',
      message: `Are you sure you want to permanently delete "${reward.title}"?`,
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

  const handleSyncReward = async (reward: Reward) => {
    if (syncingRewardId) return;
    setSyncingRewardId(reward.id);
    try {
      const res = await apiPost<{
        success: boolean;
        old_points: number;
        new_points: number;
        price: number;
        message: string;
        error?: string;
      }>('sync_reward', { reward_id: reward.id });

      if (res?.success) {
        showToast(res.message, { type: 'success' });
        await refresh();
      } else {
        showToast(res?.error || res?.message || 'Failed to sync reward', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to sync reward from store', { type: 'error' });
    } finally {
      setSyncingRewardId(null);
    }
  };

  return (
    <PageContainer
      title={showRedeemed ? 'Redeemed Rewards' : 'Family Rewards'}
      icon={showRedeemed ? 'fas fa-medal' : 'fas fa-trophy'}
      iconClass="section-icon-rewards"
      badge={showRedeemed ? `${filteredRedeemedRewards.length} redeemed` : `${filteredAvailableRewards.length} available`}
      boxed={!isStandalonePage}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={showRedeemed ? 'fas fa-gift' : 'fas fa-clock-rotate-left'}
            onClick={() => setShowRedeemed(!showRedeemed)}
            title={showRedeemed ? 'View available rewards store' : 'View redemption history'}
          >
            {showRedeemed ? 'Available' : 'Redeemed'}
          </Button>
          {!showRedeemed && isParent && (
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-plus"
              onClick={openAddModal}
            >
              Add Reward
            </Button>
          )}
        </div>
      }
      toolbar={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <PillButton
            onClick={() => setSelectedPersonId(null)}
            icon="fas fa-users"
            className="member-filter-pill member-filter-all"
            title="All Family"
            style={{
              padding: '6px 14px',
              border: selectedPersonId === null ? '2px solid var(--color-primary)' : '1px solid rgba(148,163,184,0.28)',
              background: selectedPersonId === null ? 'var(--color-primary)' : 'rgba(15,23,42,0.45)',
              color: selectedPersonId === null ? '#ffffff' : 'var(--cr-text-primary)',
              fontWeight: 800,
              fontSize: '0.9rem',
              boxShadow: selectedPersonId === null ? '0 3px 12px rgba(59,130,246,0.35)' : 'none',
            }}
          >
            All Family
          </PillButton>
          {family.map((person) => {
            const isSelected = selectedPerson?.id === person.id;
            const pts = (person.points || 0) + (person.bonus_points || 0);
            const ptsDisplay = isCash ? `$${pts.toFixed(2)}` : `${pts} pts`;
            return (
              <PillButton
                key={person.id}
                onClick={() => setSelectedPersonId(isSelected ? null : person.id)}
                className="member-filter-pill"
                title={`${person.name} (${ptsDisplay})`}
                style={{
                  padding: '4px 12px 4px 6px',
                  border: isSelected
                    ? `2px solid ${person.color || '#60a5fa'}`
                    : '1px solid rgba(148,163,184,0.28)',
                  background: isSelected
                    ? person.color || 'rgba(59,130,246,0.28)'
                    : 'rgba(15,23,42,0.45)',
                  color: isSelected ? '#0f172a' : 'var(--cr-text-primary)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  boxShadow: isSelected ? '0 3px 12px rgba(0,0,0,0.28)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <UserAvatar
                  avatar={person.avatar}
                  name={person.name}
                  color={person.color}
                  size={26}
                  borderWidth={1.5}
                />
                <span className="member-filter-name">{person.name}</span>
                <span
                  className="member-filter-badge"
                  style={{
                    fontSize: '0.75rem',
                    padding: '1px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: isSelected ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.12)',
                    color: isSelected ? '#f8fafc' : '#cbd5e1',
                    fontWeight: 800,
                  }}
                >
                  {ptsDisplay}
                </span>
              </PillButton>
            );
          })}
        </div>
      }
    >
      {/* AVAILABLE REWARDS VIEW */}
      {!showRedeemed && (
        <>
          {filteredAvailableRewards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--cr-text-secondary)' }}>
              <p style={{ margin: '0 0 16px', fontSize: '1rem' }}>No rewards available in this view.</p>
              {isParent && (
                <Button variant="primary" size="md" icon="fas fa-plus" onClick={openAddModal}>
                  Add First Reward
                </Button>
              )}
            </div>
          )}

          <ResponsiveGrid className="rewards-grid-modern" minColWidth="260px">
            {filteredAvailableRewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                family={family}
                selectedPerson={selectedPerson}
                isCash={isCash}
                isParent={isParent}
                onRedeem={handleRedeemReward}
                onEdit={openEditModal}
                onDelete={handleDeleteReward}
                onSyncReward={handleSyncReward}
                isSyncing={syncingRewardId === reward.id}
              />
            ))}
          </ResponsiveGrid>
        </>
      )}

      {/* REDEEMED REWARDS VIEW */}
      {showRedeemed && (
        <>
          {filteredRedeemedRewards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--cr-text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎉</div>
              <p style={{ margin: 0, fontSize: '1rem' }}>No redeemed rewards in history yet.</p>
            </div>
          )}

          <ResponsiveGrid className="rewards-grid-modern" minColWidth="260px">
            {filteredRedeemedRewards.map((reward) => {
              const person = family.find((p) => p.name === reward.assigned_to);
              const reqPts = Number(reward.points_required || 0);
              return (
                <div
                  key={reward.id}
                  style={{
                    borderRadius: 'var(--card-radius, 16px)',
                    background: 'var(--cr-surface-1, rgba(30, 41, 59, 0.7))',
                    border: '1.5px solid rgba(34, 197, 94, 0.35)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      height: 130,
                      position: 'relative',
                      background: 'radial-gradient(circle at 50% 35%, rgba(34, 197, 94, 0.22) 0%, #0f172a 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {reward.image_url ? (
                      <img
                        src={resolveAssetUrl(reward.image_url)}
                        alt={reward.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <i className="fas fa-gift" style={{ fontSize: '3rem', color: '#86efac', opacity: 0.7 }} />
                    )}
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Badge variant="success">✓ Redeemed</Badge>
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f8fafc' }}>
                      {reward.title}
                    </div>
                    {reward.description && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--cr-text-secondary)', lineHeight: 1.4 }}>
                        {reward.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {person ? (
                          <UserAvatar avatar={person.avatar} name={person.name} color={person.color} size={22} />
                        ) : (
                          <i className="fas fa-user" style={{ color: '#94a3b8', fontSize: '0.85rem' }} />
                        )}
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                          {reward.assigned_to || 'Family'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4ade80' }}>
                        {isCash ? `$${reqPts.toFixed(2)}` : `${reqPts} pts`}
                      </span>
                    </div>

                    {isParent && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="fas fa-trash-alt"
                          onClick={() => handleDeleteReward(reward)}
                          title="Delete from history"
                          style={{ color: '#ef4444' }}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </ResponsiveGrid>
        </>
      )}

      <RewardEditModal
        open={modalOpen}
        editingReward={editingReward}
        initialImportUrl={initialImportUrl}
        family={family}
        isCash={isCash}
        onClose={() => {
          setModalOpen(false);
          setInitialImportUrl(null);
        }}
        onSaved={refresh}
      />

      <ClaimRewardModal
        reward={redeemPickerReward}
        family={family}
        onClose={() => setRedeemPickerReward(null)}
        onConfirmClaim={handleRedeemReward}
      />

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
                Woohoo! 🚀
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default RewardsSection;
