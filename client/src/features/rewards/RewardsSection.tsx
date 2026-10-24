import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Reward, Person } from '../../types';
import { apiPost } from '../../api';
import { PageContainer, Button, PillButton, ResponsiveGrid, UserAvatar } from '../../components/ui';
import { RewardCard } from './components/RewardCard';
import { RewardEditModal } from './components/RewardEditModal';
import { ClaimRewardModal } from './components/ClaimRewardModal';

export interface RewardsSectionProps {
  isStandalonePage?: boolean;
}

export const RewardsSection: React.FC<RewardsSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, playSound, showToast, confirm, isParent } = useApp();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [redeemPickerReward, setRedeemPickerReward] = useState<Reward | null>(null);
  const [celebratingReward, setCelebratingReward] = useState<{ title: string; personName: string } | null>(null);

  if (!data) return null;

  const family: Person[] = (data.family || []).filter((p) => p.role !== 'family');
  const rewards: Reward[] = data.rewards || [];
  const availableRewards = rewards.filter((r) => !r.completed);
  const isCash = data.reward_system === 'cash';

  const selectedPerson = selectedPersonId != null ? family.find((p) => p.id === selectedPersonId) || null : null;

  const filteredRewards = useMemo(() => {
    if (!selectedPerson) return availableRewards;
    return availableRewards.filter(
      (r) =>
        r.assigned_to === 'Everyone' ||
        r.assigned_to === 'All' ||
        !r.assigned_to ||
        r.assigned_to === selectedPerson.name
    );
  }, [availableRewards, selectedPerson]);

  const openAddModal = () => {
    setEditingReward(null);
    setModalOpen(true);
  };

  const openEditModal = (r: Reward) => {
    setEditingReward(r);
    setModalOpen(true);
  };

  const handleRedeemReward = async (reward: Reward, targetPerson?: Person) => {
    const isEveryone = reward.assigned_to === 'Everyone' || reward.assigned_to === 'All' || !reward.assigned_to;
    const personToRedeem = targetPerson || (isEveryone ? selectedPerson : family.find((p) => p.name === reward.assigned_to));

    if (isEveryone && !personToRedeem) {
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

  return (
    <PageContainer
      title="Family Rewards"
      icon="fas fa-trophy"
      iconClass="section-icon-rewards"
      badge={availableRewards.length}
      boxed={!isStandalonePage}
      actions={
        isParent ? (
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-plus"
            onClick={openAddModal}
          >
            Add Reward
          </Button>
        ) : null
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
      {filteredRewards.length === 0 && (
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
        {filteredRewards.map((reward) => (
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
          />
        ))}
      </ResponsiveGrid>

      <RewardEditModal
        open={modalOpen}
        editingReward={editingReward}
        family={family}
        isCash={isCash}
        onClose={() => setModalOpen(false)}
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
