import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost, resolveAssetUrl } from '../api';
import { Reward } from '../types';

export const RewardsSection: React.FC = () => {
  const { data, refresh, adultMode, playSound, showToast, formatRewardValue } = useApp();

  // Create reward state
  const [title, setTitle] = useState('');
  const [pointsRequired, setPointsRequired] = useState('10');
  const [assignedTo, setAssignedTo] = useState('');
  const [description, setDescription] = useState('');
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
  const [showRedeemed, setShowRedeemed] = useState(false);

  if (!data) return null;

  const family = data.family || [];
  const rewards = data.rewards || [];
  const availableRewards = rewards.filter((r) => !r.completed);
  const redeemedRewards = rewards.filter((r) => r.completed);

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const targetPerson = assignedTo || family[0]?.name || '';
    if (!targetPerson) {
      showToast('Please add a family member first', { type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('points_required', String(parseFloat(pointsRequired) || 10));
      fd.append('assigned_to', targetPerson);
      fd.append('description', description.trim());
      if (imageFile) {
        fd.append('image_file', imageFile);
      } else if (imageUrl.trim()) {
        fd.append('image_url', imageUrl.trim());
      }

      const res = await apiPost<{ success: boolean; error?: string }>('add_reward', fd);
      if (res.success !== false) {
        setTitle('');
        setDescription('');
        setImageUrl('');
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
      <section className="section-heading" id="rewards-section" style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>🎁 Rewards Shop</h2>
            <p className="section-subtitle">Save up your points and redeem awesome rewards!</p>
          </div>
          {redeemedRewards.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRedeemed((prev) => !prev)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                border: '1px solid rgba(255,255,255,0.14)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showRedeemed ? 'Hide Redeemed' : `🏆 Redeemed (${redeemedRewards.length})`}
            </button>
          )}
        </div>
      </section>

      {/* Available Rewards Grid */}
      {availableRewards.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 28,
            textAlign: 'center',
            borderRadius: 16,
            opacity: 0.8,
          }}
        >
          <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎁</div>
          <div>No active rewards yet. Add a reward below to motivate the family!</div>
        </div>
      ) : (
        <div
          className="rewards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {availableRewards.map((reward) => {
            const person = family.find((p) => p.name === reward.assigned_to);
            const currentPts = person ? Number((person.points || 0) + (person.bonus_points || 0)) : 0;
            const reqPts = Number(reward.points_required || 1);
            const pct = Math.min(100, Math.round((currentPts / Math.max(1, reqPts)) * 100));
            const canAfford = currentPts >= reqPts;

            return (
              <div
                key={reward.id}
                className="reward-card card"
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: canAfford
                    ? '2px solid rgba(34,197,94,0.55)'
                    : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div>
                  {reward.image_url ? (
                    <div style={{ height: 150, overflow: 'hidden', background: 'rgba(0,0,0,0.25)' }}>
                      <img
                        src={resolveAssetUrl(reward.image_url)}
                        alt={reward.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        height: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      🎁
                    </div>
                  )}

                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{reward.title}</h3>
                      <span
                        style={{
                          background: 'rgba(245,158,11,0.2)',
                          color: '#fbbf24',
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatRewardValue(reqPts)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', opacity: 0.75, marginTop: 4 }}>
                      For: <strong>{reward.assigned_to}</strong>
                    </div>

                    {reward.description && (
                      <p style={{ fontSize: '0.86rem', opacity: 0.85, marginTop: 8, marginBottom: 0 }}>
                        {reward.description}
                      </p>
                    )}

                    {/* Progress towards reward */}
                    <div style={{ marginTop: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.76rem',
                          opacity: 0.8,
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          {formatRewardValue(currentPts)} / {formatRewardValue(reqPts)}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.12)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: canAfford ? '#22c55e' : '#f59e0b',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleRedeemReward(reward)}
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: canAfford ? '#22c55e' : 'rgba(255,255,255,0.1)',
                      color: canAfford ? '#fff' : 'rgba(255,255,255,0.45)',
                      fontWeight: 800,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {canAfford ? '🎉 Redeem Now!' : 'Keep Saving'}
                  </button>

                  {adultMode && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(reward)}
                        title="Edit Reward"
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.08)',
                          color: 'inherit',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReward(reward)}
                        title="Delete Reward"
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(239,68,68,0.18)',
                          color: '#f87171',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Redeemed Rewards Section */}
      {showRedeemed && redeemedRewards.length > 0 && (
        <div id="redeemed-section" className="card" style={{ marginTop: 20, padding: 20, borderRadius: 16 }}>
          <h3 style={{ marginTop: 0 }}>🏆 Redeemed Rewards</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {redeemedRewards.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>🏆 {r.title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                    {r.assigned_to} • {formatRewardValue(r.points_required)}
                  </div>
                </div>
                {adultMode && (
                  <button
                    type="button"
                    onClick={() => handleDeleteReward(r)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create New Reward Form */}
      <section id="create-reward-section" className="card" style={{ marginTop: 24, padding: 20, borderRadius: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>➕ Create a New Reward</h3>
        <form
          onSubmit={handleCreateReward}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>Reward Title</label>
            <input
              type="text"
              placeholder="e.g. Movie Night, Lego Set, Ice Cream..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>For Person</label>
            <select
              value={assignedTo || family[0]?.name || ''}
              onChange={(e) => setAssignedTo(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            >
              {family.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>
              {data.reward_system === 'cash' ? 'Cost ($)' : 'Points Required'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={pointsRequired}
              onChange={(e) => setPointsRequired(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>
              Image URL (optional)
            </label>
            <input
              type="text"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="Details about this reward..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <label style={{ fontSize: '0.85rem', cursor: 'pointer', opacity: 0.85 }}>
              📷 Or upload image:{' '}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ padding: '10px 24px', borderRadius: 10, fontWeight: 700 }}
            >
              {submitting ? 'Creating...' : '🎁 Create Reward'}
            </button>
          </div>
        </form>
      </section>

      {/* Edit Reward Modal */}
      {editingReward && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditingReward(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 460, width: '100%', padding: 24, borderRadius: 18 }}
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
                style={{ padding: '10px 12px', borderRadius: 10 }}
              />
              <select
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 10 }}
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
                style={{ padding: '10px 12px', borderRadius: 10 }}
              />
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                style={{ padding: '10px 12px', borderRadius: 10 }}
              />
              <input
                type="text"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="Image URL"
                style={{ padding: '10px 12px', borderRadius: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingReward(null)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.08)',
                    color: 'inherit',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '9px 20px', borderRadius: 10, fontWeight: 700 }}
                >
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
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 28,
              borderRadius: 22,
              textAlign: 'center',
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '2px solid #22c55e',
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
              className="btn-primary"
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
