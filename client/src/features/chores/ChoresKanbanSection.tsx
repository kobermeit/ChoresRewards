import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet, apiPost } from '../../api';
import { Chore, ExtraChore, Person } from '../../types';
import { Button, IconButton, PillButton, Input, PageContainer, ResponsiveGrid, UserAvatar } from '../../components/ui';
import { Modal } from '../../components/common/Modal';
import { useUiPref, useSeason } from '../../hooks/useSettings';
import { useTimer } from '../../context/TimerContext';
import { fireCelebrationFireworks, fireChoreConfetti } from '../../services/celebrationService';
import { BODY_CHALLENGES, detectChoreIcon } from './choreUtils';
import { ChoreCard } from './components/ChoreCard';
import { ChoreKanbanColumn } from './components/ChoreKanbanColumn';
import { ChoreCelebrationModal } from './components/ChoreCelebrationModal';

export interface ChoresKanbanSectionProps {
  isStandalonePage?: boolean;
}

export const ChoresKanbanSection: React.FC<ChoresKanbanSectionProps> = ({ isStandalonePage = false }) => {
  const {
    data,
    refresh,
    playSound,
    showToast,
    formatRewardValue,
    selectedChorePersonId,
    setSelectedChorePersonId,
    activeUser,
    isParent,
    isChild,
    openEditChoreModal,
  } = useApp();

  const seasonInfo = useSeason();
  const { startChoreTimer, stopChoreTimer } = useTimer();

  useEffect(() => {
    if (isChild && activeUser) {
      setSelectedChorePersonId(activeUser.id);
    }
  }, [isChild, activeUser?.id, setSelectedChorePersonId]);

  const [hideCompleted, setHideCompleted] = useUiPref('hideCompletedChores');
  const [parentManageMode, setParentManageMode] = useUiPref('parentManageMode');
  const [flippedChores, setFlippedChores] = useState<Record<number, boolean>>({});

  // Modals state
  const [editingPersonModal, setEditingPersonModal] = useState<Person | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [choreToDelete, setChoreToDelete] = useState<Chore | null>(null);
  const [extraModalPerson, setExtraModalPerson] = useState<Person | null>(null);
  const [profileModalPerson, setProfileModalPerson] = useState<Person | null>(null);
  const [profileDetails, setProfileDetails] = useState<any>(null);

  // Celebration state
  const [celebrationPerson, setCelebrationPerson] = useState<Person | null>(null);
  const [celebrationStep, setCelebrationStep] = useState<'intro' | 'quiz' | 'body' | 'bonus'>('intro');
  const [activeQuizQuestion, setActiveQuizQuestion] = useState<any>(null);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [bodyChallengeText, setBodyChallengeText] = useState<string>('');
  const [bonusAwarded, setBonusAwarded] = useState<number | null>(null);
  const [spinningBonus, setSpinningBonus] = useState(false);

  const chores: Chore[] = data?.chores || [];
  const family: Person[] = data?.family || [];
  const isCash = Boolean(data?.config?.is_cash_mode);

  const selectedPerson = useMemo(() => {
    if (!selectedChorePersonId) return null;
    return family.find((f) => f.id === selectedChorePersonId) || null;
  }, [family, selectedChorePersonId]);

  const overdueIds = useMemo(() => {
    const set = new Set<number>();
    const now = new Date();
    chores.forEach((c) => {
      if (!c.completed && c.due_datetime) {
        const d = new Date(c.due_datetime.replace(' ', 'T'));
        if (!isNaN(d.getTime()) && d < now) {
          set.add(c.id);
        }
      }
    });
    return set;
  }, [chores]);

  const toggleChoreFlip = (choreId: number, flip?: boolean) => {
    setFlippedChores((prev) => ({
      ...prev,
      [choreId]: flip !== undefined ? flip : !prev[choreId],
    }));
  };

  const handleCompleteChore = async (chore: Chore, person: Person) => {
    stopChoreTimer(chore.id);
    setFlippedChores((prev) => ({ ...prev, [chore.id]: false }));
    try {
      const res = await apiPost<{ success: boolean; earned_badges?: any[]; all_done?: boolean }>('complete_chore', {
        chore_id: chore.id,
      });

      if (res.success) {
        playSound('chore_complete');
        fireChoreConfetti();

        if (res.all_done) {
          fireCelebrationFireworks();
          setCelebrationPerson(person);
          setCelebrationStep('intro');
          setBodyChallengeText(BODY_CHALLENGES[Math.floor(Math.random() * BODY_CHALLENGES.length)]);
          setBonusAwarded(null);
          setSelectedQuizAnswer(null);
          setQuizFeedback(null);

          apiGet<{ success: boolean; question: any }>('quiz/daily')
            .then((qRes) => {
              if (qRes?.success && qRes.question) {
                setActiveQuizQuestion(qRes.question);
              }
            })
            .catch(() => {});
        }

        await refresh();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to complete chore', { type: 'error' });
    }
  };

  const handleUndoChore = async (choreId: number) => {
    try {
      await apiPost('undo_complete_chore', { chore_id: choreId });
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to undo chore', { type: 'error' });
    }
  };

  const handleDeleteChore = async (chore: Chore, permanent: boolean) => {
    stopChoreTimer(chore.id);
    setFlippedChores((prev) => ({ ...prev, [chore.id]: false }));
    try {
      if (permanent) {
        await apiPost('delete_chore', { chore_id: chore.id });
      } else {
        await apiPost('skip_chore_today', { chore_id: chore.id });
      }
      setChoreToDelete(null);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete chore', { type: 'error' });
    }
  };

  const handleSaveName = async () => {
    if (!editingPersonModal || !editingNameVal.trim()) return;
    try {
      await apiPost('update_person', {
        person_id: editingPersonModal.id,
        name: editingNameVal.trim(),
      });
      setEditingPersonModal(null);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update name', { type: 'error' });
    }
  };

  const handleOpenProfile = async (person: Person) => {
    setProfileModalPerson(person);
    try {
      const res = await apiGet<{ success: boolean; person: any }>(`person_profile?id=${person.id}`);
      if (res?.success) {
        setProfileDetails(res.person);
      }
    } catch {
      // ignore
    }
  };

  const handleClaimExtraChore = async (ec: ExtraChore, person: Person) => {
    try {
      await apiPost('claim_extra_chore', {
        extra_chore_id: ec.id,
        person_id: person.id,
      });
      setExtraModalPerson(null);
      showToast(`Added "${ec.title}" for ${person.name}!`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to pick job', { type: 'error' });
    }
  };

  const handleAnswerQuiz = (idx: number) => {
    setSelectedQuizAnswer(idx);
    const correctIdx = activeQuizQuestion.correct_index ?? activeQuizQuestion.answer;
    if (idx === correctIdx) {
      setQuizFeedback('🎉 Correct! Amazing job!');
      playSound('quiz_correct');
    } else {
      setQuizFeedback('Not quite, but great effort! Keep learning!');
      playSound('quiz_wrong');
    }
  };

  const handleSpinBonus = async () => {
    if (!celebrationPerson) return;
    setSpinningBonus(true);
    try {
      const won = Math.floor(Math.random() * 5) + 1;
      await apiPost('award_bonus_points', {
        person_id: celebrationPerson.id,
        points: won,
        reason: 'Daily All-Done Bonus',
      });
      setBonusAwarded(won);
      playSound('fanfare');
      fireCelebrationFireworks();
      await refresh();
    } catch {
      setBonusAwarded(2);
    } finally {
      setSpinningBonus(false);
    }
  };

  const availableExtraChores = (data?.extra_chores || []).filter((ec: ExtraChore) => ec.enabled);

  return (
    <PageContainer
      id="chores-section"
      className={isStandalonePage ? '' : 'chores-section'}
      title="Family Members Chores"
      subtitle={seasonInfo.greetingSuffix}
      icon="fas fa-list-check"
      iconClass="section-icon-chores"
      boxed={!isStandalonePage}
      toolbar={
        <div
          className="chores-member-filter-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            width: '100%',
          }}
        >
          <PillButton
            onClick={() => setSelectedChorePersonId(null)}
            style={{
              padding: '6px 14px',
              border: !selectedPerson ? '2px solid var(--color-primary)' : '1px solid rgba(148,163,184,0.28)',
              background: !selectedPerson ? 'var(--color-primary)' : 'rgba(15,23,42,0.45)',
              color: !selectedPerson ? '#ffffff' : 'var(--cr-text-primary)',
              fontWeight: 800,
              fontSize: '0.9rem',
              boxShadow: !selectedPerson ? '0 3px 12px rgba(59,130,246,0.35)' : 'none',
            }}
          >
            All Family
          </PillButton>

          {family.map((person) => {
            const pPending = chores.filter(
              (c) =>
                (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
                !c.deleted &&
                !c.completed
            ).length;
            const isSelected = selectedPerson?.id === person.id;
            return (
              <PillButton
                key={person.id}
                onClick={() => setSelectedChorePersonId(isSelected ? null : person.id)}
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
                <span>{person.name}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '1px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: isSelected ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.12)',
                    color: isSelected ? '#f8fafc' : '#cbd5e1',
                    fontWeight: 800,
                  }}
                >
                  {pPending > 0 ? `${pPending} left` : '✓'}
                </span>
              </PillButton>
            );
          })}

          <IconButton
            shape="circle"
            variant={hideCompleted ? 'primary' : 'ghost'}
            className={`shopping-toolbar-btn shopping-icon-btn${hideCompleted ? ' active' : ''}`}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            onClick={() => setHideCompleted(!hideCompleted)}
            icon={hideCompleted ? 'fas fa-eye-slash' : 'fas fa-eye'}
            aria-label={hideCompleted ? 'Show Completed Chores' : 'Hide Completed Chores'}
            title={hideCompleted ? 'Show Completed Chores' : 'Hide Completed Chores'}
          />

          {isParent && (
            <IconButton
              shape="circle"
              variant={parentManageMode ? 'primary' : 'ghost'}
              className={`shopping-toolbar-btn shopping-icon-btn${parentManageMode ? ' active' : ''}`}
              style={{ flexShrink: 0 }}
              onClick={() => setParentManageMode(!parentManageMode)}
              icon="fas fa-sliders"
              aria-label={parentManageMode ? 'Parent Controls Active' : 'Clean View Active'}
              title={parentManageMode ? 'Parent Controls Active' : 'Clean View Active'}
            />
          )}
        </div>
      }
    >
      {selectedPerson ? (
        <div className="single-person-chore-view">
          {(() => {
            const pChores = chores.filter(
              (c) =>
                (c.assigned_to_id === selectedPerson.id || c.assigned_to === selectedPerson.name) &&
                !c.deleted
            );
            const pending = pChores.filter((c) => !c.completed);
            const completed = pChores.filter((c) => c.completed);
            const visible = hideCompleted ? pending : [...pending, ...completed];
            const completeLabel = activeUser && activeUser.id === selectedPerson.id ? 'Complete' : `Complete for ${selectedPerson.name}`;

            if (visible.length === 0) {
              return (
                <div className="no-chores-banner">
                  <div className="no-chores-emoji">🎉</div>
                  <div className="no-chores-text">ALL DONE!</div>
                  <div className="no-chores-subtext">No pending chores for {selectedPerson.name}</div>
                </div>
              );
            }

            return (
              <ResponsiveGrid minColWidth="240px" gap="18px">
                {visible.map((chore) => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    person={selectedPerson}
                    isCash={isCash}
                    isParent={Boolean(isParent)}
                    parentManageMode={Boolean(parentManageMode)}
                    isOverdue={!chore.completed && (overdueIds.has(chore.id) || Boolean(chore.is_overdue))}
                    completeBtnLabel={completeLabel}
                    isFlipped={Boolean(flippedChores[chore.id])}
                    onComplete={handleCompleteChore}
                    onUndo={handleUndoChore}
                    onStartTimer={startChoreTimer}
                    onToggleFlip={toggleChoreFlip}
                    onEdit={(c) => openEditChoreModal(c)}
                    onDelete={(c) => setChoreToDelete(c)}
                  />
                ))}
              </ResponsiveGrid>
            );
          })()}
        </div>
      ) : (
        <div id="kanban">
          {family.map((person) => {
            const personChores = chores.filter(
              (c) =>
                (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
                !c.deleted
            );
            const completeLabel = activeUser && activeUser.id === person.id ? 'Complete' : `Complete for ${person.name}`;

            return (
              <ChoreKanbanColumn
                key={person.id}
                person={person}
                chores={personChores}
                hideCompleted={Boolean(hideCompleted)}
                overdueIds={overdueIds}
                isCash={isCash}
                isParent={Boolean(isParent)}
                parentManageMode={Boolean(parentManageMode)}
                completeBtnLabel={completeLabel}
                flippedChores={flippedChores}
                availableExtraChores={availableExtraChores}
                onOpenProfile={handleOpenProfile}
                onSelectPerson={(pid) => setSelectedChorePersonId(pid)}
                onEditName={(p) => {
                  setEditingPersonModal(p);
                  setEditingNameVal(p.name);
                }}
                onPickExtra={(p) => setExtraModalPerson(p)}
                onAddChore={(pid) => openEditChoreModal(null, pid)}
                onCompleteChore={handleCompleteChore}
                onUndoChore={handleUndoChore}
                onStartTimer={startChoreTimer}
                onToggleFlip={toggleChoreFlip}
                onEditChore={(c) => openEditChoreModal(c)}
                onDeleteChore={(c) => setChoreToDelete(c)}
                onDropColumn={() => {}}
              />
            );
          })}
        </div>
      )}

      {/* Edit Person Name Modal */}
      <Modal
        open={Boolean(editingPersonModal)}
        onClose={() => setEditingPersonModal(null)}
        title="Edit Name"
        icon="fas fa-user-edit"
        maxWidth={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button variant="secondary" onClick={() => setEditingPersonModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveName}>
              Save Name
            </Button>
          </div>
        }
      >
        <Input
          label="Enter new name"
          value={editingNameVal}
          onChange={(e) => setEditingNameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveName();
          }}
          autoFocus
          placeholder="Enter new name"
        />
      </Modal>

      {/* Delete / Skip Chore Modal */}
      <Modal
        open={Boolean(choreToDelete)}
        onClose={() => setChoreToDelete(null)}
        title={choreToDelete?.is_daily || choreToDelete?.days_of_week ? 'Delete Daily Chore' : 'Delete Chore'}
        icon="fas fa-trash-alt"
        maxWidth={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setChoreToDelete(null)}>
              Cancel
            </Button>
            {(choreToDelete?.is_daily || choreToDelete?.days_of_week) && (
              <Button
                variant="secondary"
                style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                onClick={() => choreToDelete && handleDeleteChore(choreToDelete, false)}
              >
                Skip for Today
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => choreToDelete && handleDeleteChore(choreToDelete, true)}
            >
              {choreToDelete?.is_daily || choreToDelete?.days_of_week ? 'Delete Permanently' : 'Delete Chore'}
            </Button>
          </div>
        }
      >
        {choreToDelete && (
          <div style={{ fontSize: '1.05rem', color: 'var(--cr-text-primary)', lineHeight: 1.4 }}>
            {choreToDelete.is_daily || choreToDelete.days_of_week
              ? 'Do you want to delete this daily chore permanently, or just for today?'
              : `Are you sure you want to delete "${choreToDelete.title}"?`}
          </div>
        )}
      </Modal>

      {/* Extra Chores Modal */}
      <Modal
        open={Boolean(extraModalPerson)}
        onClose={() => setExtraModalPerson(null)}
        title={extraModalPerson ? `Extra Chores for ${extraModalPerson.name}` : 'Extra Chores'}
        icon="fas fa-bolt"
        maxWidth={540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button variant="secondary" onClick={() => setExtraModalPerson(null)}>
              Close
            </Button>
          </div>
        }
      >
        {extraModalPerson && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ opacity: 0.75, fontSize: '0.88rem', margin: 0 }}>
              Want to earn extra rewards? Pick an extra job below!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {availableExtraChores.map((ec) => (
                <div
                  key={ec.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--card-radius)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.5rem' }}>{detectChoreIcon(ec.title, ec.icon)}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{ec.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>
                        +{formatRewardValue(ec.points)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleClaimExtraChore(ec, extraModalPerson)}
                  >
                    Pick Job
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Profile & Badges Modal */}
      <Modal
        open={Boolean(profileModalPerson)}
        onClose={() => setProfileModalPerson(null)}
        title={profileModalPerson ? `${profileModalPerson.name}'s Profile` : 'Profile & Badges'}
        icon="fas fa-id-badge"
        maxWidth={540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button variant="secondary" onClick={() => setProfileModalPerson(null)}>
              Close
            </Button>
          </div>
        }
      >
        {profileModalPerson && (() => {
          const pColor = profileModalPerson.color || '#555';
          const totalPts = Number((profileModalPerson.points || 0) + (profileModalPerson.bonus_points || 0));
          const streak = profileDetails?.streak?.current_streak ?? profileModalPerson.streak?.current_streak ?? 0;
          const bestStreak = profileDetails?.streak?.longest_streak ?? profileModalPerson.streak?.longest_streak ?? 0;
          const totalDone = profileDetails?.total_completed ?? profileModalPerson.total_completed ?? 0;
          const allBadges = profileDetails?.badges || data?.badge_definitions || [];
          const earnedCount = allBadges.filter((b: any) => b.earned).length;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                className="profile-hero"
                style={{ background: `${pColor}22`, border: `2px solid ${pColor}` }}
              >
                <UserAvatar
                  avatar={profileModalPerson.avatar}
                  name={profileModalPerson.name}
                  color={profileModalPerson.color}
                  size={76}
                  borderWidth={3.5}
                />
                <h1 className="profile-name">{profileModalPerson.name}</h1>
                <div className="profile-stats-row">
                  <div className="profile-stat">
                    <div className="profile-stat-value">{totalDone}</div>
                    <div className="profile-stat-label">Chores Done</div>
                  </div>
                  <div className="profile-stat">
                    <div className="profile-stat-value">
                      {isCash ? `$${totalPts.toFixed(2)}` : totalPts.toFixed(2)}
                    </div>
                    <div className="profile-stat-label">{isCash ? 'Balance' : 'Points'}</div>
                  </div>
                  <div className="profile-stat">
                    <div className="profile-stat-value">🔥 {streak}</div>
                    <div className="profile-stat-label">Day Streak</div>
                  </div>
                  <div className="profile-stat">
                    <div className="profile-stat-value">
                      {earnedCount}/{allBadges.length}
                    </div>
                    <div className="profile-stat-label">Badges</div>
                  </div>
                </div>
                {bestStreak > streak && bestStreak > 0 && (
                  <div className="profile-best-streak">Best streak: {bestStreak} days 🏅</div>
                )}
              </div>
              <h2 className="profile-section-title" style={{ marginTop: 12 }}>
                Badge Collection
              </h2>
              <div className="profile-badge-grid">
                {allBadges.map((b: any) => {
                  const earned = Boolean(b.earned);
                  return (
                    <div
                      key={b.key}
                      className={`profile-badge-card ${earned ? 'badge-earned' : 'badge-locked'}`}
                    >
                      <div className="profile-badge-emoji">{b.emoji}</div>
                      <div className="profile-badge-name">{b.name}</div>
                      <div className="profile-badge-desc">{b.desc}</div>
                      {!earned && (
                        <div className="badge-locked-label">
                          <i className="fas fa-lock" /> Locked
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* All-Done Multi-step Celebration Modal */}
      <ChoreCelebrationModal
        person={celebrationPerson}
        step={celebrationStep}
        activeQuizQuestion={activeQuizQuestion}
        selectedQuizAnswer={selectedQuizAnswer}
        quizFeedback={quizFeedback}
        bodyChallengeText={bodyChallengeText}
        bonusAwarded={bonusAwarded}
        spinningBonus={spinningBonus}
        formatRewardValue={formatRewardValue}
        onClose={() => setCelebrationPerson(null)}
        onStartQuizOrBody={() => setCelebrationStep(activeQuizQuestion ? 'quiz' : 'body')}
        onAnswerQuiz={handleAnswerQuiz}
        onGoToBody={() => setCelebrationStep('body')}
        onGoToBonus={() => setCelebrationStep('bonus')}
        onSpinBonus={handleSpinBonus}
      />
    </PageContainer>
  );
};

export default ChoresKanbanSection;
