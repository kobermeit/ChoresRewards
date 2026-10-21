import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAvatarUrl } from '../api';
import { BadgeItem, Chore, ExtraChore, Person } from '../types';
import { SectionHelpTip } from './HelpTooltipAndView';
import { Modal } from './common/Modal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { FormErrorAlert } from './FormErrorAlert';
import { Button, IconButton, PillButton, Input, Card, Badge, ResponsiveGrid, FormGrid, FormField, PageContainer, ItemCard, UserAvatar, FlipCard } from './ui';
import { useTimer } from '../context/TimerContext';
import { ChoreTimerCardBack } from './ChoreTimerCardBack';
import { fireCelebrationFireworks, fireChoreConfetti } from '../services/celebrationService';

const CHORE_EMOJI_OPTIONS = [
  '', '✅', '🍽️', '🧺', '🗑️', '🧹', '🚿', '🦷', '👕', '🌱', '🍳', '🥗',
  '🎵', '📖', '🎓', '🎒', '🐶', '🐱', '🦮', '🐾', '💧', '💊', '📦', '🧽',
  '🛏️', '🚗', '🛒', '🎮', '📱', '🖥️', '😴', '🏋️', '⭐', '🔥', '🌟',
  '🧼', '🪣', '🪥', '🧻', '🛋️', '🪟', '🧴', '🧦', '👟', '🪴', '🌻',
  '🔨', '🔧', '🪛', '✂️', '🍲', '🍞', '🍎', '🥛', '☕', '🍕', '🦴',
  '🐟', '🦜', '🐹', '✏️', '📝', '🎨', '🧘', '🛁', '🏃', '🚲', '⚽',
  '🏀', '✉️', '📬', '🛍️', '💵', '📅', '🏆', '🥇', '🎯', '🎉', '⏰',
  '☀️', '🌙', '🧸', '🔒',
];

const INITIAL_CHORE_SUGGESTIONS = [
  'Clean Room', 'Clean Desk', 'Pack Lunch', 'Clean Playroom',
  'Pack Water Bottle', 'Brush Teeth', 'Unstack Dishwasher',
  'Put Away Laundry', 'Do a workout', 'Take Dog For A Walk',
  'Reading', 'Go to Sleep without meltdown',
];

const BODY_CHALLENGES = [
  'Do 10 star jumps!',
  'Hop on one foot 10 times!',
  'Do 5 push-ups or wall push-ups!',
  'Hold a plank or superhero pose for 15 seconds!',
  'Touch your toes 10 times!',
  'Do a 15-second happy victory dance!',
  'Balance on one leg with your eyes closed for 10 seconds!',
];

function detectChoreIcon(title: string, customIcon?: string | null): string {
  if (customIcon && customIcon.trim()) return customIcon.trim();
  const t = (title || '').toLowerCase();
  if (t.includes('tooth') || t.includes('teeth') || t.includes('dental') || t.includes('brush')) return '🦷';
  if (t.includes('dishwasher') || t.includes('dishes') || t.includes('dish')) return '🍽️';
  if (t.includes('laundry') || t.includes('washing') || t.includes('fold') || t.includes('iron') || t.includes('clothes')) return '👕';
  if (t.includes('lawn') || t.includes('mow') || t.includes('grass') || t.includes('garden') || t.includes('weed') || t.includes('yard') || t.includes('plant')) return '🌱';
  if (t.includes('rubbish') || t.includes('garbage') || t.includes('recycl') || t.includes('bins') || t.includes('bin') || t.includes('trash')) return '🗑️';
  if (t.includes('workout') || t.includes('exercise') || t.includes('gym') || t.includes('fitness') || t.includes('sport')) return '🏋️';
  if (t.includes('shop') || t.includes('grocery') || t.includes('groceries') || t.includes('market') || t.includes('supermarket')) return '🛒';
  if (t.includes('cook') || t.includes('bake') || t.includes('dinner')) return '🍳';
  if (t.includes('bath') || t.includes('shower')) return '🚿';
  if (t.includes('vacuum') || t.includes('hoover') || t.includes('sweep') || t.includes('mop')) return '🧹';
  if (t.includes('music') || t.includes('piano') || t.includes('guitar') || t.includes('violin') || t.includes('instrument') || t.includes('practis') || t.includes('practice')) return '🎵';
  if (t.includes('cat')) return '🐱';
  if (t.includes('fish')) return '🐟';
  if (t.includes('bird')) return '🐦';
  if (t.includes('hamster') || t.includes('rabbit')) return '🐹';
  if (t.includes('feed') || t.includes('animal')) return '🐾';
  if (t.includes('medicine') || t.includes('pill') || t.includes('vitamin')) return '💊';
  if (t.includes('dog') || t.includes('sam')) return '🐶';
  if (t.includes('walk')) return '🦮';
  if (t.includes('sleep') || t.includes('meltdown') || t.includes('night')) return '😴';
  if (t.includes('lunch') || t.includes('breakfast') || t.includes('snack') || t.includes('meal') || t.includes('eat') || t.includes('food')) return '🥗';
  if (t.includes('pack')) return '🎒';
  if (t.includes('water') || t.includes('drink') || t.includes('bottle')) return '💧';
  if (t.includes('read') || t.includes('book')) return '📖';
  if (t.includes('homework') || t.includes('school') || t.includes('learn') || t.includes('study')) return '🎓';
  if (t.includes('tidy') || t.includes('organis') || t.includes('organiz')) return '📦';
  if (t.includes('wipe') || t.includes('clean') || t.includes('sort')) return '🧽';
  if (t.includes('playroom') || t.includes('play') || t.includes('game') || t.includes('toy')) return '🎮';
  if (t.includes('desk')) return '🖥️';
  if (t.includes('bedroom') || t.includes('room') || t.includes('bed')) return '🛏️';
  if (t.includes('car') || t.includes('drive')) return '🚗';
  if (t.includes('screen') || t.includes('ipad') || t.includes('computer') || t.includes('phone') || t.includes('tv')) return '📱';
  return '✅';
}

function formatDaysTag(daysOfWeek: string | string[] | null | undefined, isDaily?: boolean): string | null {
  const raw = Array.isArray(daysOfWeek) ? daysOfWeek : daysOfWeek ? String(daysOfWeek).split(',') : [];
  const shortDays = raw.map((d) => d.trim().toLowerCase()).filter(Boolean);

  if (shortDays.length === 0) {
    return isDaily ? 'Every day' : null;
  }
  if (shortDays.length >= 7) {
    return 'Every day';
  }
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekends = ['saturday', 'sunday'];
  const sorted = [...shortDays].sort();
  if (sorted.length === 5 && sorted.every((d, i) => d === [...weekdays].sort()[i])) {
    return 'Mon – Fri';
  }
  if (sorted.length === 2 && sorted.every((d, i) => d === [...weekends].sort()[i])) {
    return 'Weekends';
  }
  const mapDay: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };
  return shortDays.map((d) => mapDay[d] || d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
}

function formatPoints(pts: number | string, isCashMode = false): string {
  const n = Number(pts) || 0;
  if (isCashMode) return `$${n.toFixed(2)}`;
  return n % 1 === 0 ? `${n.toFixed(0)}` : `${n.toFixed(1)}`;
}

export interface ChoresKanbanSectionProps {
  isStandalonePage?: boolean;
}

export const ChoresKanbanSection: React.FC<ChoresKanbanSectionProps> = ({ isStandalonePage = false }) => {
  const {
    data,
    refresh,
    adultMode,
    playSound,
    showToast,
    formatRewardValue,
    selectedChorePersonId,
    setSelectedChorePersonId,
    confirm,
    activeUser,
    isParent,
    isChild,
    openEditChoreModal,
  } = useApp();

  // If active user is a child, automatically focus their chore column
  useEffect(() => {
    if (isChild && activeUser) {
      setSelectedChorePersonId(activeUser.id);
    }
  }, [isChild, activeUser?.id, setSelectedChorePersonId]);

  // Chores section collapsed state
  const [choresCollapsed, setChoresCollapsed] = useState(false);
  const [addChoreModalOpen, setAddChoreModalOpen] = useState(false);
  const [addChoresCollapsed, setAddChoresCollapsed] = useState(true);

  // Quick suggestions
  const [choreSuggestions, setChoreSuggestions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('choreSuggestions');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_CHORE_SUGGESTIONS;
  });
  const [showAddSuggestionInput, setShowAddSuggestionInput] = useState(false);
  const [newSuggestionText, setNewSuggestionText] = useState('');
  const [suggestionsEditMode, setSuggestionsEditMode] = useState(false);

  // Add Chore form state
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newPoints, setNewPoints] = useState('1');
  const [newIcon, setNewIcon] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [newDaysOfWeek, setNewDaysOfWeek] = useState<string[]>([]);
  const [hasDueDatetime, setHasDueDatetime] = useState(false);
  const [newDueDatetime, setNewDueDatetime] = useState('');
  const [submittingChore, setSubmittingChore] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Column interactions
  const [editingPersonModal, setEditingPersonModal] = useState<Person | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [draggedPersonId, setDraggedPersonId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Hide completed chores toggle (persisted across sessions)
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cr_hide_completed_chores') === 'true';
    } catch {
      return false;
    }
  });

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

  // Time-based chores timer hook & flipped card state tracking
  const { startChoreTimer, stopChoreTimer, getChoreTimer } = useTimer();
  const [flippedChores, setFlippedChores] = useState<Record<number, boolean>>({});

  const toggleChoreFlip = (choreId: number, flipState?: boolean) => {
    setFlippedChores((prev) => ({
      ...prev,
      [choreId]: flipState !== undefined ? flipState : !prev[choreId],
    }));
  };

  useBodyScrollLock(
    Boolean(
      addChoreModalOpen ||
      editingPersonModal ||
      choreToDelete ||
      extraModalPerson ||
      profileModalPerson ||
      celebrationPerson
    )
  );

  if (!data) return null;

  const family = [...(data.family || [])]
    .filter((p) => p.role !== 'family' && p.name.toLowerCase() !== 'family')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const chores = data.chores || [];
  const overdueIds = new Set(data.overdue_chore_ids || []);
  const isCash = data.reward_system === 'cash';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? '☀️ Good morning!' : hour < 17 ? '🌤️ Good afternoon!' : '🌙 Good evening!';

  const saveSuggestions = (next: string[]) => {
    setChoreSuggestions(next);
    try {
      localStorage.setItem('choreSuggestions', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

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
        stopChoreTimer(chore.id);
        toggleChoreFlip(chore.id, false);
        playSound();
        try {
          fireChoreConfetti();
        } catch {}
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

        const remainingForPerson = chores.filter(
          (c) =>
            (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
            !c.completed &&
            !c.deleted &&
            c.id !== chore.id
        );
        await refresh();

        if (remainingForPerson.length === 0) {
          try {
            fireCelebrationFireworks();
          } catch {}
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
      // ignore
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
    const ok = await confirm({
      title: 'Clear Completed Chores?',
      message: `Clear today's completed chores for ${personName}? Repeating chores come back tomorrow, and one-off chores are removed.`,
      confirmText: 'Clear Completed',
    });
    if (!ok) return;
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

  const handleSaveName = async () => {
    if (!editingPersonModal) return;
    const trimmed = editingNameVal.trim();
    const person = editingPersonModal;
    setEditingPersonModal(null);
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

  const handleDropColumn = async (targetPerson: Person) => {
    if (draggedPersonId == null || draggedPersonId === targetPerson.id) return;
    const currentOrder = [...family];
    const fromIdx = currentOrder.findIndex((p) => p.id === draggedPersonId);
    const toIdx = currentOrder.findIndex((p) => p.id === targetPerson.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = currentOrder.splice(fromIdx, 1);
    currentOrder.splice(toIdx, 0, moved);
    setDraggedPersonId(null);

    try {
      await Promise.all(
        currentOrder.map((p, idx) => apiPost('update_order', { person_id: p.id, order: idx }))
      );
      await refresh();
    } catch {
      // ignore
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

    setFormError(null);
    setSubmittingChore(true);
    try {
      await apiPost('add_chore', {
        title: newTitle.trim(),
        assigned_to: assigned,
        points: parseFloat(newPoints) || 0,
        icon: newIcon || null,
        is_daily: isRepeating,
        days_of_week: isRepeating && newDaysOfWeek.length > 0 ? newDaysOfWeek.join(',') : null,
        due_datetime: hasDueDatetime && newDueDatetime ? newDueDatetime : null,
      });
      setNewTitle('');
      setNewIcon('');
      setNewDaysOfWeek([]);
      setIsRepeating(false);
      setHasDueDatetime(false);
      setNewDueDatetime('');
      setAddChoreModalOpen(false);
      showToast(`Added chore "${newTitle.trim()}" for ${assigned}`);
      await refresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to add chore';
      setFormError(msg);
      showToast(msg, { type: 'error' });
    } finally {
      setSubmittingChore(false);
    }
  };

  const toggleDayOfWeek = (dayFull: string) => {
    setNewDaysOfWeek((prev) =>
      prev.includes(dayFull) ? prev.filter((d) => d !== dayFull) : [...prev, dayFull]
    );
  };

  const selectedAssignee = newAssignedTo || family[0]?.name || '';
  const selectedPerson =
    selectedChorePersonId != null ? family.find((p) => p.id === selectedChorePersonId) || null : null;

  const headerActions = isParent ? (
    <Button
      variant="primary"
      size="sm"
      icon="fas fa-plus"
      onClick={() => openEditChoreModal(null)}
    >
      Add Chore
    </Button>
  ) : null;

  const filterToolbar = (
    <div
      className="chore-user-filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        gap: 8,
        width: '100%',
      }}
    >
      <PillButton
        variant={selectedPerson === null ? 'primary' : 'secondary'}
        onClick={() => setSelectedChorePersonId(null)}
        icon="fas fa-users"
        style={{
          border: selectedPerson === null ? '2px solid #60a5fa' : '1px solid rgba(148,163,184,0.28)',
          fontWeight: 800,
          fontSize: '0.9rem',
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

      {/* Hide Completed Chores Icon Button (Matches Shopping List Hide Checked) */}
      <IconButton
        shape="circle"
        variant={hideCompleted ? 'primary' : 'ghost'}
        className={`shopping-toolbar-btn shopping-icon-btn${hideCompleted ? ' active' : ''}`}
        style={{ marginLeft: 'auto', flexShrink: 0 }}
        onClick={() => {
          setHideCompleted((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('cr_hide_completed_chores', String(next));
            } catch {}
            return next;
          });
        }}
        icon={hideCompleted ? 'fas fa-eye-slash' : 'fas fa-eye'}
        aria-label={hideCompleted ? 'Show Completed Chores' : 'Hide Completed Chores'}
        title={hideCompleted ? 'Show Completed Chores' : 'Hide Completed Chores'}
      />
    </div>
  );

  return (
    <>
      <PageContainer
        id="chores-section"
        className={isStandalonePage ? '' : 'chores-section'}
        title="Family Members Chores"
        subtitle="Manage daily tasks, streaks and reward points for every family member"
        icon="fas fa-house-chimney"
        iconClass="section-icon-chores"
        helpTip={{
          title: 'Family Members Chores',
          tips: [
            'Tap any person tab below (or their name header) to switch to a full-screen Chore Grid where all of their chores fit without scrolling.',
            'Chores automatically reset at Midnight (00:00) local time.',
            'Hold and drag the bottom handle on any column to reorder family members.',
          ],
        }}
        actions={headerActions}
        toolbar={filterToolbar}
        boxed={!isStandalonePage}
      >

        {/* Single-User Responsive Grid View (Fits all chores on screen without scrolling) */}
        {selectedPerson ? (
          (() => {
            const person = selectedPerson;
            const personChores = chores.filter(
              (c) =>
                (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
                !c.deleted
            );
            const pendingChores = personChores.filter((c) => !c.completed);
            const completedChores = personChores.filter((c) => c.completed);
            const totalToday = pendingChores.length + completedChores.length;
            const doneToday = completedChores.length;
            const remaining = pendingChores.length;
            const pct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
            const totalPts = Number((person.points || 0) + (person.bonus_points || 0));
            const streakCount = person.streak?.current_streak || 0;
            const earnedBadges = (person.badges || []).filter((b) => b.earned !== false);
            const availableExtraChores = (data.extra_chores || []).filter((ec) => {
              if (!ec.enabled) return false;
              const age = person.age;
              if (age != null) {
                if (ec.min_age && age < ec.min_age) return false;
                if (ec.max_age && age > ec.max_age) return false;
              }
              return true;
            });

            return (
              <div key={person.id} className="user-chore-grid-screen" style={{ width: '100%' }}>
                {/* Single Member Header Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                    background: 'rgba(255, 255, 255, 0.04)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${person.color ? person.color + '33' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderLeft: `5px solid ${person.color || '#3b82f6'}`,
                    color: '#f8fafc',
                    padding: '14px 20px',
                    borderRadius: 16,
                    marginBottom: 16,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.25), 0 0 20px ${person.color ? person.color + '18' : 'transparent'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <UserAvatar
                      avatar={person.avatar}
                      name={person.name}
                      color={person.color}
                      size={54}
                      borderWidth={3}
                      onClick={() => handleOpenProfile(person)}
                      title={`View ${person.name}'s badges`}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>
                          {person.name}&apos;s Chores
                        </h3>
                        {streakCount > 0 && (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              background: 'rgba(249,115,22,0.2)',
                              color: '#fb923c',
                              border: '1px solid rgba(249,115,22,0.35)',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontWeight: 800,
                            }}
                          >
                            🔥 {streakCount}d streak
                          </span>
                        )}
                        {earnedBadges.length > 0 && (
                          <span style={{ fontSize: '0.95rem' }} title="Earned badges">
                            {earnedBadges.slice(0, 6).map((b) => b.emoji).join(' ')}
                          </span>
                        )}
                      </div>

                      {/* Progress fraction and bar placed tightly with the user identity */}
                      {totalToday > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                          <div
                            style={{
                              width: 140,
                              height: 10,
                              background: 'rgba(255,255,255,0.15)',
                              borderRadius: 999,
                              overflow: 'hidden',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: person.color
                                  ? `linear-gradient(90deg, ${person.color}, #10b981)`
                                  : 'linear-gradient(90deg, #10b981, #059669)',
                                borderRadius: 999,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700 }}>
                            {doneToday} of {totalToday} completed
                            <span style={{ color: remaining > 0 ? (person.color || '#60a5fa') : '#10b981', marginLeft: 6 }}>
                              • {remaining > 0 ? `${remaining} left` : 'All done! 🎉'}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>
                          No chores scheduled for today
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Balance & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: `1.5px solid ${person.color ? person.color + '66' : 'rgba(255,255,255,0.2)'}`,
                        padding: '6px 14px',
                        borderRadius: 12,
                        fontWeight: 900,
                        fontSize: '1.15rem',
                        color: person.color || '#fbbf24',
                        boxShadow: `0 2px 10px rgba(0,0,0,0.3), 0 0 12px ${person.color ? person.color + '22' : 'transparent'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {isCash ? (
                        <>
                          <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                          <span>${totalPts.toFixed(2)}</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-award" style={{ color: person.color || '#fbbf24' }} />
                          <span>{totalPts.toFixed(1)} pts</span>
                        </>
                      )}
                    </div>

                    {availableExtraChores.length > 0 && (
                      <Button
                        size="sm"
                        variant="success"
                        icon="fas fa-plus-circle"
                        onClick={() => setExtraModalPerson(person)}
                        style={{ fontSize: '0.84rem', fontWeight: 800 }}
                      >
                        Extra Job
                      </Button>
                    )}

                    {isParent && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="fas fa-plus"
                        onClick={() => openEditChoreModal(null, person.id)}
                        style={{ fontSize: '0.84rem', fontWeight: 800 }}
                      >
                        Add Chore
                      </Button>
                    )}
                  </div>
                </div>

                {/* Multi-Column Responsive Grid of Chores */}
                {(() => {
                  const visibleChores = hideCompleted ? pendingChores : [...pendingChores, ...completedChores];

                  if (visibleChores.length > 0) {
                    return (
                      <ResponsiveGrid minColWidth="240px" gap="18px">
                        {visibleChores.map((chore) => {
                          const isDone = Boolean(chore.completed);
                          const isOverdue = !isDone && (overdueIds.has(chore.id) || Boolean(chore.is_overdue));
                          const daysLabel = formatDaysTag(chore.days_of_week, chore.is_daily);
                          const memberColor = person.color || '#fbbf24';

                          const pointsPill = (
                            <div
                              style={{
                                background: 'rgba(0, 0, 0, 0.82)',
                                backdropFilter: 'blur(8px)',
                                border: `1.5px solid ${isCash ? '#4ade80' : memberColor}`,
                                color: isCash ? '#4ade80' : memberColor,
                                padding: '3px 8px',
                                borderRadius: 8,
                                fontWeight: 900,
                                fontSize: '0.86rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: `0 3px 10px rgba(0,0,0,0.5), 0 0 10px ${memberColor}33`,
                              }}
                              title="Points reward"
                            >
                              {isCash ? (
                                <>
                                  <i className="fas fa-money-bill-wave" style={{ color: '#4ade80', fontSize: '0.82rem' }} />
                                  <span>${Number(chore.points).toFixed(2)}</span>
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-star" style={{ color: memberColor, fontSize: '0.82rem' }} />
                                  <span>{formatPoints(chore.points)} pts</span>
                                </>
                              )}
                            </div>
                          );

                          const statusBadges = isDone ? (
                            <span
                              style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.45)',
                                color: '#6ee7b7',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <i className="fas fa-check" /> Done
                            </span>
                          ) : (
                            <>
                              {isOverdue ? (
                                <span
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.9)',
                                    backdropFilter: 'blur(6px)',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '0.72rem',
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                  }}
                                >
                                  🚨 Overdue
                                </span>
                              ) : daysLabel ? (
                                <span
                                  style={{
                                    background: 'rgba(0, 0, 0, 0.72)',
                                    backdropFilter: 'blur(6px)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                  }}
                                >
                                  {daysLabel}
                                </span>
                              ) : chore.is_extra ? (
                                <span
                                  style={{
                                    background: 'rgba(52, 211, 153, 0.85)',
                                    color: '#064e3b',
                                    fontWeight: 800,
                                    fontSize: '0.72rem',
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                  }}
                                >
                                  ⭐ Extra
                                </span>
                              ) : null}
                            </>
                          );

                          const subtitleNode = chore.due_datetime ? (
                            <span
                              className={`chore-tag ${isOverdue ? 'chore-tag-overdue' : 'chore-tag-due'}`}
                              style={{ fontSize: '0.72rem' }}
                            >
                              <i className="fas fa-clock" /> {isOverdue ? 'Overdue' : `Due ${chore.due_datetime}`}
                            </span>
                          ) : null;

                          const isTimed = !isDone && Boolean(chore.duration_seconds && chore.duration_seconds > 0);
                          const activeTimer = isTimed ? getChoreTimer(chore.id) : undefined;
                          const isFlipped = Boolean(flippedChores[chore.id]) || Boolean(activeTimer?.isRunning);

                          const primaryAction = isDone ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="fas fa-rotate-left"
                              fullWidth
                              onClick={async () => {
                                await apiPost('undo_complete_chore', { chore_id: chore.id });
                                await refresh();
                              }}
                              title="Undo completion (takes back points)"
                              aria-label="Undo completion"
                            />
                          ) : isTimed ? (
                            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                              <Button
                                size="sm"
                                variant="success"
                                icon="fas fa-play"
                                fullWidth
                                onClick={() => {
                                  startChoreTimer(chore);
                                  toggleChoreFlip(chore.id, true);
                                }}
                              >
                                Start ({Math.round((chore.duration_seconds || 600) / 60)}m)
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="success"
                              icon="fas fa-check"
                              fullWidth
                              className="btn-complete-chore"
                              onClick={() => handleCompleteChore(chore, person)}
                            >
                              Complete
                            </Button>
                          );

                          const secondaryActions = isParent ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <IconButton
                                size="sm"
                                variant="ghost"
                                icon="fas fa-pencil-alt"
                                aria-label="Edit chore"
                                title="Edit chore"
                                onClick={() => openEditChoreModal(chore)}
                              />
                              <IconButton
                                size="sm"
                                variant="danger"
                                icon="fas fa-trash-alt"
                                aria-label="Delete chore"
                                title="Delete chore"
                                onClick={() => setChoreToDelete(chore)}
                              />
                            </div>
                          ) : null;

                          const frontCard = (
                            <ItemCard
                              key={chore.id}
                              title={chore.title}
                              subtitle={subtitleNode}
                              description={chore.description}
                              imageUrl={chore.image_url}
                              icon={detectChoreIcon(chore.title, chore.icon)}
                              accentColor={person.color}
                              heroHeight={140}
                              pointsBadge={pointsPill}
                              statusBadges={statusBadges}
                              primaryAction={primaryAction}
                              secondaryActions={secondaryActions}
                              isOverdue={isOverdue}
                              isCompleted={isDone}
                            />
                          );

                          if (isTimed) {
                            return (
                              <FlipCard
                                key={chore.id}
                                isFlipped={isFlipped}
                                front={frontCard}
                                back={
                                  <ChoreTimerCardBack
                                    chore={chore}
                                    person={person}
                                    onFlipBack={() => toggleChoreFlip(chore.id, false)}
                                    onComplete={() => handleCompleteChore(chore, person)}
                                  />
                                }
                              />
                            );
                          }

                          return frontCard;
                        })}
                      </ResponsiveGrid>
                    );
                  }

                  if (totalToday > 0 && doneToday === totalToday) {
                    return (
                      <div className="all-done-banner" style={{ margin: '4px 0' }}>
                        <div className="all-done-emoji">🎉</div>
                        <div className="all-done-text">ALL DONE!</div>
                        <div className="all-done-subtext">Every chore for {person.name} is finished today!</div>
                      </div>
                    );
                  }

                  return (
                    <div className="no-chores-banner" style={{ margin: '4px 0' }}>
                      <div className="no-chores-emoji">😊</div>
                      <div className="no-chores-text">FREE DAY!</div>
                      <div className="no-chores-subtext">No chores scheduled for {person.name} today</div>
                    </div>
                  );
                })()}
              </div>
            );
          })()
        ) : (
        <div id="kanban">
          {family.map((person) => {
            const personChores = chores.filter(
              (c) =>
                (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
                !c.deleted
            );
            const pendingChores = personChores.filter((c) => !c.completed);
            const completedChores = personChores.filter((c) => c.completed);
            const totalToday = pendingChores.length + completedChores.length;
            const doneToday = completedChores.length;
            const remaining = pendingChores.length;
            const pct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
            const totalPts = Number((person.points || 0) + (person.bonus_points || 0));
            const streakCount = person.streak?.current_streak || 0;
            const longestStreak = person.streak?.longest_streak || 0;
            const earnedBadges = (person.badges || []).filter((b) => b.earned !== false);
            const availableExtraChores = (data.extra_chores || []).filter((ec) => {
              if (!ec.enabled) return false;
              const age = person.age;
              if (age != null) {
                if (ec.min_age && age < ec.min_age) return false;
                if (ec.max_age && age > ec.max_age) return false;
              }
              return true;
            });

            return (
              <div
                key={person.id}
                className="column"
                data-person={person.name}
                data-person-id={person.id}
                data-person-age={person.age ?? ''}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: `1.5px solid ${person.color ? person.color + '44' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderTop: `4px solid ${person.color || 'var(--color-primary)'}`,
                  borderRadius: 'var(--card-radius, 16px)',
                  boxShadow: `0 4px 20px rgba(0, 0, 0, 0.25), 0 0 20px ${person.color ? person.color + '15' : 'transparent'}`,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropColumn(person)}
              >
                {/* Column header with centered name and edit icon */}
                {/* Sleek Compact Column Header */}
                <div
                  className="chore-column-header-compact"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.22)',
                    borderRadius: 12,
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <UserAvatar
                      avatar={person.avatar}
                      name={person.name}
                      color={person.color}
                      size={40}
                      borderWidth={2.5}
                      onClick={() => handleOpenProfile(person)}
                      title={`View ${person.name}'s badges`}
                      className="avatar-tappable"
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          className="person-name"
                          style={{
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => setSelectedChorePersonId(person.id)}
                          title={`Tap to open ${person.name}'s full-screen chore grid`}
                        >
                          {person.name}
                        </span>
                        <i
                          className="fas fa-pencil-alt edit-name-icon admin-only"
                          style={{
                            fontSize: '0.65rem',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                            opacity: 0.7,
                          }}
                          title="Edit Name"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPersonModal(person);
                            setEditingNameVal(person.name);
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {streakCount > 0 && (
                          <span style={{ fontSize: '0.72rem', color: '#fb923c', fontWeight: 700 }}>
                            🔥 {streakCount}d
                          </span>
                        )}
                        {earnedBadges.length > 0 && (
                          <span style={{ fontSize: '0.75rem' }} title="Badges">
                            {earnedBadges.slice(0, 3).map((b) => b.emoji).join('')}
                          </span>
                        )}
                        <label
                          htmlFor={`avatar-upload-${person.id}`}
                          className="admin-only"
                          style={{ cursor: 'pointer', fontSize: '0.65rem', opacity: 0.5, color: '#94a3b8', marginLeft: 2 }}
                          title="Change Photo"
                        >
                          <i className="fa-solid fa-image" />
                        </label>
                        <label
                          htmlFor={`color-picker-${person.id}`}
                          className="admin-only"
                          style={{ cursor: 'pointer', fontSize: '0.65rem', opacity: 0.5, color: '#94a3b8' }}
                          title="Change Color"
                        >
                          <i className="fas fa-palette" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Prominent Balance Badge for Kids on Tablets */}
                  <span
                    className="chore-points-badge"
                    title={`Total ${isCash ? 'cash' : 'points'} for ${person.name}`}
                    style={{
                      position: 'static',
                      fontSize: '1.15rem',
                      fontWeight: 900,
                      padding: '4px 12px',
                      borderRadius: 12,
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      flexShrink: 0,
                    }}
                  >
                    {isCash ? (
                      <>
                        <i className="fas fa-money-bill-wave" style={{ color: '#4ade80', marginRight: 4 }} />
                        <span className="chore-points-value">${totalPts.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-award" style={{ color: '#fbbf24', marginRight: 4 }} />
                        <span className="chore-points-value">{formatPoints(totalPts)}</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Hidden photo upload & color inputs */}
                <input
                  ref={(el) => {
                    fileInputRefs.current[person.id] = el;
                  }}
                  id={`avatar-upload-${person.id}`}
                  type="file"
                  name="avatar"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(person, file);
                  }}
                />
                <input
                  type="color"
                  id={`color-picker-${person.id}`}
                  value={person.color || '#cccccc'}
                  onChange={(e) => handleColorChange(person, e.target.value)}
                  style={{ display: 'none' }}
                />

                {/* Progress Bar */}
                {totalToday > 0 && (
                  <div className="chore-progress-wrap" data-done={doneToday} data-total={totalToday} style={{ marginBottom: 6 }}>
                    <div
                      className="chore-progress-bar-container"
                      title={`${doneToday} of ${totalToday} done`}
                      style={{ height: 8 }}
                    >
                      <div className="chore-progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="chore-progress-label" style={{ fontSize: '0.74rem', marginTop: 3 }}>
                      {remaining} left ({doneToday}/{totalToday})
                    </div>
                  </div>
                )}

                {/* Chores Stream in Column */}
                {(() => {
                  const visibleChores = hideCompleted ? pendingChores : [...pendingChores, ...completedChores];

                  if (visibleChores.length > 0) {
                    return (
                      <div className="chores-list" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        {visibleChores.map((chore) => {
                          const isDone = Boolean(chore.completed);
                          const isOverdue = !isDone && (overdueIds.has(chore.id) || Boolean(chore.is_overdue));
                          const daysLabel = formatDaysTag(chore.days_of_week, chore.is_daily);
                          const memberColor = person.color || '#fbbf24';

                          const pointsPill = (
                            <div
                              style={{
                                background: 'rgba(0, 0, 0, 0.82)',
                                backdropFilter: 'blur(8px)',
                                border: `1.5px solid ${isCash ? '#4ade80' : memberColor}`,
                                color: isCash ? '#4ade80' : memberColor,
                                padding: '2px 7px',
                                borderRadius: 7,
                                fontWeight: 900,
                                fontSize: '0.82rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: `0 2px 8px rgba(0,0,0,0.4), 0 0 8px ${memberColor}33`,
                              }}
                              title="Points reward"
                            >
                              {isCash ? (
                                <>
                                  <i className="fas fa-money-bill-wave" style={{ color: '#4ade80', fontSize: '0.78rem' }} />
                                  <span>${Number(chore.points).toFixed(2)}</span>
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-star" style={{ color: memberColor, fontSize: '0.78rem' }} />
                                  <span>{formatPoints(chore.points)}</span>
                                </>
                              )}
                            </div>
                          );

                          const statusBadges = isDone ? (
                            <span
                              style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.45)',
                                color: '#6ee7b7',
                                fontWeight: 800,
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <i className="fas fa-check" /> Done
                            </span>
                          ) : (
                            <>
                              {isOverdue ? (
                                <span
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.9)',
                                    backdropFilter: 'blur(6px)',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '0.68rem',
                                    padding: '2px 6px',
                                    borderRadius: 6,
                                  }}
                                >
                                  🚨 Overdue
                                </span>
                              ) : daysLabel ? (
                                <span
                                  style={{
                                    background: 'rgba(0, 0, 0, 0.72)',
                                    backdropFilter: 'blur(6px)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    fontWeight: 700,
                                    fontSize: '0.68rem',
                                    padding: '2px 6px',
                                    borderRadius: 6,
                                  }}
                                >
                                  {daysLabel}
                                </span>
                              ) : null}
                            </>
                          );

                          const subtitleNode = chore.due_datetime ? (
                            <span
                              className={`chore-tag ${isOverdue ? 'chore-tag-overdue' : 'chore-tag-due'}`}
                              style={{ fontSize: '0.7rem' }}
                            >
                              <i className="fas fa-clock" /> {isOverdue ? 'Overdue' : `Due ${chore.due_datetime}`}
                            </span>
                          ) : null;

                          const isTimed = !isDone && Boolean(chore.duration_seconds && chore.duration_seconds > 0);
                          const activeTimer = isTimed ? getChoreTimer(chore.id) : undefined;
                          const isFlipped = Boolean(flippedChores[chore.id]) || Boolean(activeTimer?.isRunning);

                          const primaryAction = isDone ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="fas fa-rotate-left"
                              fullWidth
                              onClick={async () => {
                                await apiPost('undo_complete_chore', { chore_id: chore.id });
                                await refresh();
                              }}
                              title="Undo completion (takes back points)"
                              aria-label="Undo completion"
                            />
                          ) : isTimed ? (
                            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                              <Button
                                size="sm"
                                variant="success"
                                icon="fas fa-play"
                                fullWidth
                                onClick={() => {
                                  startChoreTimer(chore);
                                  toggleChoreFlip(chore.id, true);
                                }}
                              >
                                Start ({Math.round((chore.duration_seconds || 600) / 60)}m)
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="success"
                              icon="fas fa-check"
                              fullWidth
                              className="btn-complete-chore"
                              onClick={() => handleCompleteChore(chore, person)}
                            >
                              Complete
                            </Button>
                          );

                          const secondaryActions = isParent ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <IconButton
                                size="sm"
                                variant="ghost"
                                icon="fas fa-pencil-alt"
                                aria-label="Edit chore"
                                title="Edit chore"
                                onClick={() => openEditChoreModal(chore)}
                              />
                              <IconButton
                                size="sm"
                                variant="danger"
                                icon="fas fa-trash-alt"
                                aria-label="Delete chore"
                                title="Delete chore"
                                onClick={() => setChoreToDelete(chore)}
                              />
                            </div>
                          ) : null;

                          const frontCard = (
                            <ItemCard
                              key={chore.id}
                              title={chore.title}
                              subtitle={subtitleNode}
                              description={chore.description}
                              imageUrl={chore.image_url}
                              icon={detectChoreIcon(chore.title, chore.icon)}
                              accentColor={person.color}
                              heroHeight={140}
                              pointsBadge={pointsPill}
                              statusBadges={statusBadges}
                              primaryAction={primaryAction}
                              secondaryActions={secondaryActions}
                              isOverdue={isOverdue}
                              isCompleted={isDone}
                            />
                          );

                          if (isTimed) {
                            return (
                              <FlipCard
                                key={chore.id}
                                isFlipped={isFlipped}
                                front={frontCard}
                                back={
                                  <ChoreTimerCardBack
                                    chore={chore}
                                    person={person}
                                    onFlipBack={() => toggleChoreFlip(chore.id, false)}
                                    onComplete={() => handleCompleteChore(chore, person)}
                                  />
                                }
                              />
                            );
                          }

                          return frontCard;
                        })}
                      </div>
                    );
                  }

                  if (totalToday > 0 && doneToday === totalToday) {
                    return (
                      <div className="all-done-banner">
                        <div className="all-done-emoji">🎉</div>
                        <div className="all-done-text">ALL DONE!</div>
                        <div className="all-done-subtext">Amazing work today!</div>
                      </div>
                    );
                  }

                  return (
                    <div className="no-chores-banner">
                      <div className="no-chores-emoji">😊</div>
                      <div className="no-chores-text">FREE DAY!</div>
                      <div className="no-chores-subtext">No chores today</div>
                    </div>
                  );
                })()}

                {/* Earn More Prompt when no pending chores and extra chores exist */}
                {pendingChores.length === 0 && availableExtraChores.length > 0 && (
                  <div className="earn-more-prompt" id={`earn-more-${person.id}`}>
                    <p className="earn-more-prompt-kicker">Want to earn more?</p>
                    <button
                      type="button"
                      className="earn-more-btn"
                      onClick={() => setExtraModalPerson(person)}
                    >
                      <i className="fas fa-plus-circle" /> Pick an extra job
                    </button>
                  </div>
                )}

                {/* + Add Chore tile */}
                {isParent && (
                  <button
                    type="button"
                    className="chore-kanban-add-btn"
                    onClick={() => openEditChoreModal(null, person.id)}
                  >
                    <i className="fas fa-plus" /> Add Chore
                  </button>
                )}

              </div>
            );
          })}
        </div>
        )}
      </PageContainer>

      {/* EDIT NAME MODAL */}
      <Modal
        open={Boolean(editingPersonModal)}
        onClose={() => setEditingPersonModal(null)}
        title="Edit Name"
        icon="fas fa-user-edit"
        maxWidth={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setEditingPersonModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveName}
            >
              Save Name
            </Button>
          </div>
        }
      >
        <Input
          label="Enter new name"
          type="text"
          value={editingNameVal}
          onChange={(e) => setEditingNameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveName();
          }}
          autoFocus
          placeholder="Enter new name"
        />
      </Modal>

      {/* DELETE / SKIP CHORE MODAL */}
      <Modal
        open={Boolean(choreToDelete)}
        onClose={() => setChoreToDelete(null)}
        title={choreToDelete?.is_daily || choreToDelete?.days_of_week ? 'Delete Daily Chore' : 'Delete Chore'}
        icon="fas fa-trash-alt"
        maxWidth={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => setChoreToDelete(null)}
            >
              Cancel
            </Button>
            {(choreToDelete?.is_daily || choreToDelete?.days_of_week) && (
              <Button
                variant="secondary"
                style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                onClick={() => handleDeleteChore(choreToDelete, false)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: '1.05rem', color: 'var(--cr-text-primary)', lineHeight: 1.4 }}>
              {choreToDelete.is_daily || choreToDelete.days_of_week
                ? 'Do you want to delete this daily chore permanently, or just for today?'
                : `Are you sure you want to delete "${choreToDelete.title}"?`}
            </div>
          </div>
        )}
      </Modal>

      {/* EXTRA CHORES MODAL */}
      <Modal
        open={Boolean(extraModalPerson)}
        onClose={() => setExtraModalPerson(null)}
        title={extraModalPerson ? `Extra Chores for ${extraModalPerson.name}` : 'Extra Chores'}
        icon="fas fa-bolt"
        maxWidth={540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setExtraModalPerson(null)}
            >
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

      {/* PROFILE & BADGES MODAL */}
      <Modal
        open={Boolean(profileModalPerson)}
        onClose={() => setProfileModalPerson(null)}
        title={profileModalPerson ? `${profileModalPerson.name}'s Profile` : 'Profile & Badges'}
        icon="fas fa-id-badge"
        maxWidth={540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => setProfileModalPerson(null)}
            >
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
          const allBadges = profileDetails?.badges || data.badge_definitions || [];
          const earnedCount = allBadges.filter((b) => b.earned).length;

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
                {allBadges.map((b) => {
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

      {/* ALL-DONE CELEBRATION MODAL */}
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
                  You finished all your chores for today! Ready for your daily Brain &amp; Body Bonus?
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setCelebrationStep(activeQuizQuestion ? 'quiz' : 'body')}
                    style={{ fontWeight: 800 }}
                  >
                    🚀 Let's Go!
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setCelebrationPerson(null)}
                  >
                    Close
                  </Button>
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
                      <Button
                        key={idx}
                        variant={chosen ? 'primary' : 'secondary'}
                        size="md"
                        fullWidth
                        onClick={() => handleAnswerQuiz(idx)}
                        disabled={selectedQuizAnswer !== null}
                        style={{
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          padding: '12px 16px',
                          border: chosen ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.18)',
                          fontWeight: 700,
                        }}
                      >
                        {opt}
                      </Button>
                    );
                  })}
                </div>
                {quizFeedback && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontWeight: 700, color: '#fbbf24' }}>{quizFeedback}</p>
                    <Button
                      variant="primary"
                      onClick={() => setCelebrationStep('body')}
                      style={{ fontWeight: 700 }}
                    >
                      Next: Body Challenge 🏃
                    </Button>
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
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setCelebrationStep('bonus')}
                  style={{ fontWeight: 800 }}
                >
                  ✅ Done! Spin for Bonus Points 🎰
                </Button>
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
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={spinningBonus}
                      onClick={handleSpinBonus}
                      style={{
                        padding: '14px 28px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#0f172a',
                        border: 'none',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                      }}
                    >
                      {spinningBonus ? '🎲 Spinning...' : '🎲 SPIN NOW!'}
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 style={{ color: '#fbbf24', margin: '12px 0' }}>
                      🎉 You won +{formatRewardValue(bonusAwarded)}!
                    </h2>
                    <Button
                      variant="primary"
                      onClick={() => setCelebrationPerson(null)}
                      style={{ fontWeight: 700, marginTop: 10 }}
                    >
                      Awesome! 🙌
                    </Button>
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
