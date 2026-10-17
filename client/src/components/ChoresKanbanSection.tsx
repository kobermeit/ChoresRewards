import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAvatarUrl } from '../api';
import { BadgeItem, Chore, ExtraChore, Person } from '../types';

const CHORE_ICONS = ['🧹', '🛏️', '🍽️', '🗑️', '🐕', '📚', '🧺', '🦷', '🌱', '🧸', '🧽', '🚿', '🎒', '👟', '⭐'];

const BODY_CHALLENGES = [
  'Do 10 star jumps!',
  'Hop on one foot 10 times!',
  'Do 5 push-ups or wall push-ups!',
  'Hold a plank or superhero pose for 15 seconds!',
  'Touch your toes 10 times!',
  'Do a 15-second happy victory dance!',
  'Balance on one leg with your eyes closed for 10 seconds!',
];

export const ChoresKanbanSection: React.FC = () => {
  const { data, refresh, adultMode, openAdultPinModal, playSound, showToast, formatRewardValue } = useApp();

  // Add Chore form state
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newPoints, setNewPoints] = useState('1');
  const [newIcon, setNewIcon] = useState('🧹');
  const [newScheduleType, setNewScheduleType] = useState<'daily' | 'days' | 'once'>('daily');
  const [newDaysOfWeek, setNewDaysOfWeek] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [submittingChore, setSubmittingChore] = useState(false);

  // Column interactions
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [expandedCompleted, setExpandedCompleted] = useState<Record<number, boolean>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Delete / Skip Chore Modal
  const [choreToDelete, setChoreToDelete] = useState<Chore | null>(null);

  // Extra Chores Modal
  const [extraModalPerson, setExtraModalPerson] = useState<Person | null>(null);

  // Profile & Badges Modal
  const [profileModalPerson, setProfileModalPerson] = useState<Person | null>(null);
  const [profileDetails, setProfileDetails] = useState<{
    streak: { current_streak: number; longest_streak: number; last_completed_date: string | null };
    total_completed: number;
    badges: BadgeItem[];
  } | null>(null);

  // All-Done Celebration Modal
  const [celebrationPerson, setCelebrationPerson] = useState<Person | null>(null);
  const [celebrationStep, setCelebrationStep] = useState<'intro' | 'quiz' | 'body' | 'bonus' | 'done'>('intro');
  const [activeQuizQuestion, setActiveQuizQuestion] = useState<any | null>(null);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [bodyChallengeText, setBodyChallengeText] = useState('');
  const [bonusAwarded, setBonusAwarded] = useState<number | null>(null);
  const [spinningBonus, setSpinningBonus] = useState(false);

  if (!data) return null;

  const family = data.family || [];
  const chores = data.chores || [];
  const overdueIds = new Set(data.overdue_chore_ids || []);

  const handleCompleteChore = async (chore: Chore, person: Person) => {
    try {
      const res = await apiPost<{
        success: boolean;
        new_points: number;
        new_badges?: BadgeItem[];
      }>('complete_chore', {
        chore_id: chore.id,
        date_completed: new Date().toISOString(),
      });

      if (res.success) {
        playSound();
        showToast(`✅ "${chore.title}" completed! (+${formatRewardValue(chore.points)})`, {
          type: 'success',
          undoAction: async () => {
            await apiPost('undo_complete_chore', { chore_id: chore.id });
            await refresh();
          },
        });

        if (res.new_badges && res.new_badges.length > 0) {
          for (const b of res.new_badges) {
            showToast(`🏅 New Badge Unlocked for ${person.name}: ${b.emoji} ${b.name}!`, { type: 'badge' });
          }
        }

        // Check if this was the last pending chore for this person
        const remainingForPerson = chores.filter(
          (c) => c.assigned_to === person.name && !c.completed && !c.deleted && c.id !== chore.id
        );
        await refresh();

        if (remainingForPerson.length === 0) {
          openCelebrationModal(person);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to complete chore', { type: 'error' });
    }
  };

  const openCelebrationModal = (person: Person) => {
    setCelebrationPerson(person);
    setCelebrationStep('intro');
    setSelectedQuizAnswer(null);
    setQuizFeedback(null);
    setBonusAwarded(null);
    setBodyChallengeText(BODY_CHALLENGES[Math.floor(Math.random() * BODY_CHALLENGES.length)]);

    // Pick an age-appropriate quiz question if enabled
    if (data.quiz_questions_enabled && Array.isArray(data.quiz_questions) && data.quiz_questions.length > 0) {
      const age = person.age ?? 8;
      const matching = data.quiz_questions.filter((q: any) => {
        if (q.enabled === false) return false;
        const minA = q.min_age ?? 0;
        const maxA = q.max_age ?? 99;
        return age >= minA && age <= maxA;
      });
      const pool = matching.length > 0 ? matching : data.quiz_questions;
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      setActiveQuizQuestion(chosen);
    } else {
      setActiveQuizQuestion(null);
    }
  };

  const handleAnswerQuiz = async (idx: number) => {
    if (!activeQuizQuestion || !celebrationPerson || selectedQuizAnswer !== null) return;
    setSelectedQuizAnswer(idx);
    const correctIdx =
      typeof activeQuizQuestion.answer === 'number'
        ? activeQuizQuestion.answer
        : activeQuizQuestion.options?.indexOf(activeQuizQuestion.answer) ?? 0;
    const isCorrect = idx === correctIdx;
    setQuizFeedback(
      isCorrect
        ? '🎉 Spot on! Awesome job!'
        : `Good try! The answer was: ${activeQuizQuestion.options?.[correctIdx] ?? activeQuizQuestion.answer}`
    );

    try {
      await apiPost('log_quiz_result', {
        person_name: celebrationPerson.name,
        question: activeQuizQuestion.q || activeQuizQuestion.question,
        chosen_answer: activeQuizQuestion.options?.[idx] ?? String(idx),
        correct_answer: activeQuizQuestion.options?.[correctIdx] ?? String(correctIdx),
        correct: isCorrect,
      });
    } catch {
      // ignore logging error
    }
  };

  const handleSpinBonus = async () => {
    if (!celebrationPerson || spinningBonus) return;
    setSpinningBonus(true);
    setTimeout(async () => {
      const possibleBonuses = [1, 2, 3, 5];
      const pts = possibleBonuses[Math.floor(Math.random() * possibleBonuses.length)];
      try {
        await apiPost('award_bonus_points', {
          person_id: celebrationPerson.id,
          bonus_points: pts,
        });
        setBonusAwarded(pts);
        playSound();
        await refresh();
      } catch (err: any) {
        showToast(err.message || 'Could not award bonus points', { type: 'error' });
      } finally {
        setSpinningBonus(false);
      }
    }, 900);
  };

  const handleDeleteChore = async (chore: Chore, permanent: boolean) => {
    try {
      await apiPost('delete_chore', {
        chore_id: chore.id,
        permanent,
      });
      setChoreToDelete(null);
      showToast(permanent ? 'Chore permanently deleted' : 'Chore skipped for today');
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete chore', { type: 'error' });
    }
  };

  const handleClearCompleted = async (personName: string) => {
    try {
      await apiPost('clear_completed_chores', { assigned_to: personName });
      showToast(`Cleared completed chores for ${personName}`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to clear chores', { type: 'error' });
    }
  };

  const handleClaimExtraChore = async (extra: ExtraChore, person: Person) => {
    try {
      const res = await apiPost<{ success: boolean; error?: string }>('extra_chores/claim', {
        extra_id: extra.id,
        person_id: person.id,
      });
      if (res.success) {
        playSound();
        showToast(`⚡ Added "${extra.title}" to ${person.name}'s chores!`);
        setExtraModalPerson(null);
        await refresh();
      } else {
        showToast(res.error || 'Could not claim extra chore', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to claim extra chore', { type: 'error' });
    }
  };

  const handleOpenProfile = async (person: Person) => {
    setProfileModalPerson(person);
    setProfileDetails(null);
    try {
      const res = await apiGet<{
        success: boolean;
        streak: { current_streak: number; longest_streak: number; last_completed_date: string | null };
        total_completed: number;
        badges: BadgeItem[];
      }>(`person/${person.id}/badges`);
      if (res.success) {
        setProfileDetails({
          streak: res.streak,
          total_completed: res.total_completed,
          badges: res.badges,
        });
      }
    } catch {
      // fallback to bootstrap data
      setProfileDetails({
        streak: person.streak,
        total_completed: person.total_completed,
        badges: person.badges,
      });
    }
  };

  const handleColorChange = async (person: Person, color: string) => {
    try {
      await apiPost('save_column_color', { person_id: person.id, color });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAvatarUpload = async (person: Person, file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const res = await apiPost<{ success: boolean; error?: string }>(`upload_avatar/${person.id}`, fd);
      if (res.success) {
        showToast(`Updated ${person.name}'s avatar!`);
        await refresh();
      } else {
        showToast(res.error || 'Avatar upload failed', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Avatar upload failed', { type: 'error' });
    }
  };

  const handleSaveName = async (person: Person) => {
    const trimmed = editingNameVal.trim();
    setEditingNameId(null);
    if (!trimmed || trimmed === person.name) return;
    try {
      const res = await apiPost<{ success: boolean; error?: string }>('update_person_name', {
        person_id: person.id,
        new_name: trimmed,
      });
      if (res.success) {
        showToast(`Renamed to ${trimmed}`);
        await refresh();
      } else {
        showToast(res.error || 'Rename failed', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Rename failed', { type: 'error' });
    }
  };

  const handleAddChoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const assigned = newAssignedTo || family[0]?.name || '';
    if (!assigned) {
      showToast('Please add a family member first', { type: 'error' });
      return;
    }

    setSubmittingChore(true);
    try {
      let due_datetime: string | null = null;
      if (newDueDate && newDueTime) {
        due_datetime = `${newDueDate}T${newDueTime}`;
      }
      await apiPost('add_chore', {
        title: newTitle.trim(),
        assigned_to: assigned,
        points: parseFloat(newPoints) || 1,
        icon: newIcon,
        is_daily: newScheduleType === 'daily',
        days_of_week: newScheduleType === 'days' ? newDaysOfWeek.join(',') : null,
        due_date: newDueDate || null,
        due_datetime,
      });
      setNewTitle('');
      setNewDueDate('');
      setNewDueTime('');
      showToast(`Added chore "${newTitle.trim()}" for ${assigned}`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add chore', { type: 'error' });
    } finally {
      setSubmittingChore(false);
    }
  };

  const toggleDayOfWeek = (day: string) => {
    setNewDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  return (
    <>
      {/* FAMILY CHORES KANBAN BOARD */}
      <section className="section-heading" id="chores-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>🧹 Family Chores</h2>
            <p className="section-subtitle">Complete your daily chores to earn rewards and build your streak!</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.9rem' }}
            onClick={() => {
              if (!adultMode) {
                openAdultPinModal(() => {
                  document.getElementById('add-chores-section')?.scrollIntoView({ behavior: 'smooth' });
                });
              } else {
                document.getElementById('add-chores-section')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            + Add Chore
          </button>
        </div>
      </section>

      <div id="kanban" className="kanban-board">
        {family.map((person) => {
          const personChores = chores.filter((c) => c.assigned_to === person.name && !c.deleted);
          const pendingChores = personChores.filter((c) => !c.completed);
          const completedChores = personChores.filter((c) => c.completed);
          const prog = data.family_progress?.[person.name] || {
            completed: completedChores.length,
            total: personChores.length,
          };
          const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
          const totalPts = Number((person.points || 0) + (person.bonus_points || 0));
          const streakCount = person.streak?.current_streak || 0;
          const earnedBadges = (person.badges || []).filter((b) => b.earned !== false);

          return (
            <div
              key={person.id}
              className="kanban-column"
              style={{
                borderTop: `5px solid ${person.color || '#4a6fa5'}`,
                backgroundColor: person.color ? `${person.color}18` : undefined,
              }}
            >
              {/* Column Header */}
              <div className="column-header" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  {/* Avatar with click-to-upload */}
                  <div
                    style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                    title="Click to change avatar"
                    onClick={() => fileInputRefs.current[person.id]?.click()}
                  >
                    <img
                      src={resolveAvatarUrl(person.avatar)}
                      alt={person.name}
                      className="avatar"
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `3px solid ${person.color || '#60a5fa'}`,
                      }}
                    />
                    <input
                      ref={(el) => {
                        fileInputRefs.current[person.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarUpload(person, file);
                      }}
                    />
                  </div>

                  {/* Name & Points */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {editingNameId === person.id ? (
                        <input
                          type="text"
                          value={editingNameVal}
                          onChange={(e) => setEditingNameVal(e.target.value)}
                          onBlur={() => handleSaveName(person)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(person);
                            if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #60a5fa',
                            background: 'rgba(0,0,0,0.3)',
                            color: 'inherit',
                            fontWeight: 700,
                          }}
                        />
                      ) : (
                        <h3
                          style={{ margin: 0, fontSize: '1.2rem', cursor: adultMode ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (adultMode) {
                              setEditingNameId(person.id);
                              setEditingNameVal(person.name);
                            }
                          }}
                          title={adultMode ? 'Click to rename' : person.name}
                        >
                          {person.name}
                        </h3>
                      )}
                      {person.is_admin && (
                        <span
                          title="Parent / Admin"
                          style={{
                            fontSize: '0.7rem',
                            background: 'rgba(245,158,11,0.2)',
                            color: '#fbbf24',
                            padding: '2px 6px',
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span
                        className="points-badge"
                        style={{
                          background: 'rgba(59,130,246,0.2)',
                          color: '#60a5fa',
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: '0.88rem',
                        }}
                      >
                        ⭐ {formatRewardValue(totalPts)}
                      </span>

                      {streakCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(person)}
                          style={{
                            background: 'rgba(249,115,22,0.2)',
                            color: '#fb923c',
                            border: 'none',
                            padding: '3px 9px',
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                          title="View Streak & Badges"
                        >
                          🔥 {streakCount}d
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenProfile(person)}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          color: 'inherit',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: 999,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                        title="View Profile & Badges"
                      >
                        🏅 {earnedBadges.length}
                      </button>
                    </div>
                  </div>

                  {/* Color Picker */}
                  <label
                    title="Change column color"
                    style={{
                      cursor: 'pointer',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: person.color || '#4a6fa5',
                      border: '2px solid rgba(255,255,255,0.4)',
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="color"
                      value={person.color || '#4a6fa5'}
                      onChange={(e) => handleColorChange(person, e.target.value)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                  </label>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', marginTop: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      opacity: 0.8,
                      marginBottom: 4,
                    }}
                  >
                    <span>
                      Today: {prog.completed}/{prog.total} done
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
                        background: pct === 100 ? '#22c55e' : person.color || '#3b82f6',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Pending Chores List */}
              <div className="chore-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {pendingChores.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '22px 12px',
                      borderRadius: 12,
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px dashed rgba(34,197,94,0.35)',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>🎉</div>
                    <div style={{ fontWeight: 700, color: '#4ade80' }}>All chores done for today!</div>
                    {prog.total > 0 && (
                      <button
                        type="button"
                        onClick={() => openCelebrationModal(person)}
                        style={{
                          marginTop: 8,
                          background: 'rgba(34,197,94,0.2)',
                          color: '#4ade80',
                          border: '1px solid rgba(34,197,94,0.4)',
                          borderRadius: 8,
                          padding: '5px 12px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                        }}
                      >
                        🎁 Daily Bonus & Quiz
                      </button>
                    )}
                  </div>
                ) : (
                  pendingChores.map((chore) => {
                    const isOverdue = overdueIds.has(chore.id) || Boolean(chore.is_overdue);
                    return (
                      <div
                        key={chore.id}
                        className={`chore-card ${isOverdue ? 'overdue' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: isOverdue ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.06)',
                          border: isOverdue
                            ? '1px solid rgba(239,68,68,0.45)'
                            : '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '1.45rem', flexShrink: 0 }}>{chore.icon || '🧹'}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.98rem', wordBreak: 'break-word' }}>
                              {chore.title}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                                marginTop: 4,
                                fontSize: '0.75rem',
                                opacity: 0.8,
                              }}
                            >
                              <span
                                style={{
                                  background: 'rgba(59,130,246,0.2)',
                                  color: '#93c5fd',
                                  padding: '1px 7px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                }}
                              >
                                +{formatRewardValue(chore.points)}
                              </span>
                              {chore.is_extra && (
                                <span
                                  style={{
                                    background: 'rgba(245,158,11,0.2)',
                                    color: '#fcd34d',
                                    padding: '1px 7px',
                                    borderRadius: 6,
                                    fontWeight: 700,
                                  }}
                                >
                                  ⚡ Extra
                                </span>
                              )}
                              {chore.days_of_week ? (
                                <span>📅 {chore.days_of_week}</span>
                              ) : chore.is_daily ? (
                                <span>🔄 Daily</span>
                              ) : (
                                <span>📌 Once-off</span>
                              )}
                              {isOverdue && (
                                <span style={{ color: '#f87171', fontWeight: 700 }}>⚠️ Overdue</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="complete-btn"
                            title="Mark Complete"
                            onClick={() => handleCompleteChore(chore, person)}
                            style={{
                              background: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 10,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                            }}
                          >
                            ✓ Done
                          </button>
                          {adultMode && (
                            <button
                              type="button"
                              title="Skip or Delete Chore"
                              onClick={() => setChoreToDelete(chore)}
                              style={{
                                background: 'rgba(239,68,68,0.18)',
                                color: '#f87171',
                                border: 'none',
                                borderRadius: 8,
                                padding: '8px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Extra Chores Button */}
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setExtraModalPerson(person)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: 'rgba(245,158,11,0.15)',
                    border: '1px dashed rgba(245,158,11,0.45)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Claim Extra Chore
                </button>
              </div>

              {/* Completed Chores Drawer */}
              {completedChores.length > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCompleted((prev) => ({ ...prev, [person.id]: !prev[person.id] }))
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        opacity: 0.75,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                      }}
                    >
                      {expandedCompleted[person.id] ? '▼' : '▶'} Completed Today ({completedChores.length})
                    </button>
                    {adultMode && (
                      <button
                        type="button"
                        onClick={() => handleClearCompleted(person.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {expandedCompleted[person.id] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {completedChores.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.04)',
                            opacity: 0.7,
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ textDecoration: 'line-through' }}>
                            {c.icon || '✅'} {c.title}
                          </span>
                          <button
                            type="button"
                            title="Undo completion"
                            onClick={async () => {
                              await apiPost('undo_complete_chore', { chore_id: c.id });
                              await refresh();
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                            }}
                          >
                            ↩ Undo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ADD CHORES FORM SECTION (Adult Mode or accessible at bottom) */}
      <section id="add-chores-section" className="card" style={{ marginTop: 28, padding: 20, borderRadius: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>➕ Add a New Chore</h3>
        <form
          onSubmit={handleAddChoreSubmit}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>Chore Title</label>
            <input
              type="text"
              placeholder="e.g. Make bed, Empty dishwasher..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>Assign To</label>
            <select
              value={newAssignedTo || family[0]?.name || ''}
              onChange={(e) => setNewAssignedTo(e.target.value)}
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
              {data.reward_system === 'cash' ? 'Amount ($)' : 'Points'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4, opacity: 0.8 }}>Schedule</label>
            <select
              value={newScheduleType}
              onChange={(e) => setNewScheduleType(e.target.value as any)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
            >
              <option value="daily">Every Day (Daily Reset)</option>
              <option value="days">Specific Days of Week</option>
              <option value="once">Once-Off Task</option>
            </select>
          </div>

          {newScheduleType === 'days' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 6, opacity: 0.8 }}>
                Select Days of Week
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
                  const active = newDaysOfWeek.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDayOfWeek(d)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: active ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                        background: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
                        color: active ? '#60a5fa' : 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 6, opacity: 0.8 }}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CHORE_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setNewIcon(ic)}
                  style={{
                    fontSize: '1.3rem',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: newIcon === ic ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.12)',
                    background: newIcon === ic ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              type="submit"
              disabled={submittingChore}
              className="btn-primary"
              style={{ padding: '10px 24px', borderRadius: 10, fontWeight: 700 }}
            >
              {submittingChore ? 'Adding...' : '➕ Add Chore'}
            </button>
          </div>
        </form>
      </section>

      {/* DELETE / SKIP CHORE MODAL */}
      {choreToDelete && (
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
          onClick={() => setChoreToDelete(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: '100%', padding: 24, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Remove "{choreToDelete.title}"?</h3>
            <p style={{ opacity: 0.8, fontSize: '0.92rem' }}>
              {choreToDelete.is_daily || choreToDelete.days_of_week
                ? 'Would you like to skip this chore just for today, or delete it permanently?'
                : 'Are you sure you want to delete this chore?'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {(choreToDelete.is_daily || choreToDelete.days_of_week) && (
                <button
                  type="button"
                  onClick={() => handleDeleteChore(choreToDelete, false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: 'rgba(59,130,246,0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59,130,246,0.4)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⏭️ Skip for Today Only
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteChore(choreToDelete, true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🗑️ Delete Permanently
              </button>
              <button
                type="button"
                onClick={() => setChoreToDelete(null)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'inherit',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXTRA CHORES MODAL */}
      {extraModalPerson && (
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
          onClick={() => setExtraModalPerson(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>⚡ Extra Chores for {extraModalPerson.name}</h3>
              <button
                type="button"
                onClick={() => setExtraModalPerson(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ opacity: 0.75, fontSize: '0.88rem', marginTop: 0 }}>
              Want to earn extra rewards? Claim a bonus chore below!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.extra_chores || [])
                .filter((ec) => {
                  if (!ec.enabled) return false;
                  const age = extraModalPerson.age;
                  if (age != null) {
                    if (ec.min_age && age < ec.min_age) return false;
                    if (ec.max_age && age > ec.max_age) return false;
                  }
                  return true;
                })
                .map((ec) => (
                  <div
                    key={ec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.5rem' }}>{ec.icon || '⚡'}</span>
                      <div>
                        <div style={{ fontWeight: 700 }}>{ec.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>
                          +{formatRewardValue(ec.points)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClaimExtraChore(ec, extraModalPerson)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        background: '#f59e0b',
                        color: '#0f172a',
                        border: 'none',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Claim
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE & BADGES MODAL */}
      {profileModalPerson && (
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
          onClick={() => setProfileModalPerson(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24, borderRadius: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={resolveAvatarUrl(profileModalPerson.avatar)}
                  alt={profileModalPerson.name}
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{profileModalPerson.name}</h3>
                  <div style={{ opacity: 0.75, fontSize: '0.9rem', marginTop: 4 }}>
                    Total Completed: <strong>{profileDetails?.total_completed ?? profileModalPerson.total_completed}</strong> chores
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalPerson(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Streak Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 18,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.35)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fb923c' }}>
                  🔥 {profileDetails?.streak?.current_streak ?? profileModalPerson.streak?.current_streak ?? 0} days
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Current Streak</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa' }}>
                  🏆 {profileDetails?.streak?.longest_streak ?? profileModalPerson.streak?.longest_streak ?? 0} days
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Longest Streak</div>
              </div>
            </div>

            {/* Badges Grid */}
            <h4 style={{ marginBottom: 10 }}>🏅 Achievements & Badges</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {(profileDetails?.badges || data.badge_definitions || []).map((b) => {
                const earned = Boolean(b.earned);
                return (
                  <div
                    key={b.key}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: earned ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.04)',
                      border: earned ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.08)',
                      opacity: earned ? 1 : 0.45,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>{b.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{b.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: 2 }}>{b.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ALL-DONE CELEBRATION MODAL (Quiz + Body Challenge + Bonus Spin) */}
      {celebrationPerson && (
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
          onClick={() => setCelebrationPerson(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 28,
              borderRadius: 22,
              textAlign: 'center',
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '2px solid rgba(245,158,11,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {celebrationStep === 'intro' && (
              <>
                <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>🎉🌟🎉</div>
                <h2 style={{ margin: '0 0 8px' }}>Amazing Job, {celebrationPerson.name}!</h2>
                <p style={{ opacity: 0.85, marginBottom: 20 }}>
                  You finished all your chores for today! Ready for your daily Brain & Body Bonus?
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setCelebrationStep(activeQuizQuestion ? 'quiz' : 'body')}
                    style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 800, fontSize: '1rem' }}
                  >
                    🚀 Let's Go!
                  </button>
                  <button
                    type="button"
                    onClick={() => setCelebrationPerson(null)}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.08)',
                      color: 'inherit',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {celebrationStep === 'quiz' && activeQuizQuestion && (
              <>
                <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🧠 Brain Boost</div>
                <h3 style={{ marginBottom: 16 }}>{activeQuizQuestion.q || activeQuizQuestion.question}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(activeQuizQuestion.options || []).map((opt: string, idx: number) => {
                    const chosen = selectedQuizAnswer === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAnswerQuiz(idx)}
                        disabled={selectedQuizAnswer !== null}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 12,
                          border: chosen ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.18)',
                          background: chosen ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)',
                          color: 'inherit',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          cursor: selectedQuizAnswer === null ? 'pointer' : 'default',
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizFeedback && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontWeight: 700, color: '#fbbf24' }}>{quizFeedback}</p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setCelebrationStep('body')}
                      style={{ padding: '10px 22px', borderRadius: 10, fontWeight: 700 }}
                    >
                      Next: Body Challenge 🏃
                    </button>
                  </div>
                )}
              </>
            )}

            {celebrationStep === 'body' && (
              <>
                <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>🏃‍♂️ Body Challenge!</div>
                <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '14px 0 22px', color: '#4ade80' }}>
                  {bodyChallengeText}
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setCelebrationStep('bonus')}
                  style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 800 }}
                >
                  ✅ Done! Spin for Bonus Points 🎰
                </button>
              </>
            )}

            {celebrationStep === 'bonus' && (
              <>
                <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>🎰 Bonus Wheel</div>
                {bonusAwarded === null ? (
                  <>
                    <p style={{ opacity: 0.85, marginBottom: 18 }}>
                      Spin to win extra bonus points for finishing everything today!
                    </p>
                    <button
                      type="button"
                      disabled={spinningBonus}
                      onClick={handleSpinBonus}
                      style={{
                        padding: '14px 28px',
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#0f172a',
                        border: 'none',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      {spinningBonus ? '🎲 Spinning...' : '🎲 SPIN NOW!'}
                    </button>
                  </>
                ) : (
                  <>
                    <h2 style={{ color: '#fbbf24', margin: '12px 0' }}>
                      🎉 You won +{formatRewardValue(bonusAwarded)}!
                    </h2>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setCelebrationPerson(null)}
                      style={{ padding: '10px 24px', borderRadius: 10, fontWeight: 700, marginTop: 10 }}
                    >
                      Awesome! 🙌
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
