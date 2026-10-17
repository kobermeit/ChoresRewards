import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAvatarUrl } from '../api';
import { BadgeItem, Chore, ExtraChore, Person } from '../types';
import { SectionHelpTip } from './HelpTooltipAndView';
import { Modal } from './common/Modal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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

function formatDaysTag(daysOfWeek: string | string[] | null | undefined): string | null {
  if (!daysOfWeek) return null;
  const raw = Array.isArray(daysOfWeek) ? daysOfWeek : String(daysOfWeek).split(',');
  const shortDays = raw.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (shortDays.length === 0) return null;
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekends = ['saturday', 'sunday'];
  const sorted = [...shortDays].sort();
  if (sorted.length === 5 && sorted.every((d, i) => d === [...weekdays].sort()[i])) {
    return 'Weekdays';
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

export const ChoresKanbanSection: React.FC = () => {
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

  // Column interactions
  const [editingPersonModal, setEditingPersonModal] = useState<Person | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [expandedCompleted, setExpandedCompleted] = useState<Record<number, boolean>>({});
  const [draggedPersonId, setDraggedPersonId] = useState<number | null>(null);
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

        const remainingForPerson = chores.filter(
          (c) =>
            (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
            !c.completed &&
            !c.deleted &&
            c.id !== chore.id
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
      showToast(err.message || 'Failed to add chore', { type: 'error' });
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

  return (
    <>
      <section id="chores-section" className="chores-section">
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px' }}>
          <i className="fas fa-house-chimney" style={{ color: 'var(--cr-text-primary)' }} />
          <span>Family Members Chores</span>
          <SectionHelpTip
            title="Family Members Chores"
            tips={[
              'Tap any person tab below (or their name header) to switch to a full-screen Chore Grid where all of their chores fit without scrolling.',
              'Chores automatically reset at Midnight (00:00) local time.',
              'Hold and drag the bottom handle on any column to reorder family members.',
            ]}
          />
        </h2>

        {/* User Filter Bar (All Family vs Single User Grid View) */}
        <div
          className="chore-user-filter-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14,
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedChorePersonId(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 999,
              border: selectedPerson === null ? '2px solid #60a5fa' : '1px solid rgba(148,163,184,0.28)',
              background: selectedPerson === null ? 'rgba(59,130,246,0.22)' : 'rgba(15,23,42,0.45)',
              color: selectedPerson === null ? '#93c5fd' : 'var(--cr-text-primary)',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <i className="fas fa-users" /> All Family
          </button>

          {family.map((person) => {
            const pPending = chores.filter(
              (c) =>
                (c.assigned_to_id === person.id || c.assigned_to === person.name) &&
                !c.deleted &&
                !c.completed
            ).length;
            const isSelected = selectedPerson?.id === person.id;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedChorePersonId(isSelected ? null : person.id)}
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
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? '0 3px 12px rgba(0,0,0,0.28)' : 'none',
                }}
              >
                <img
                  src={resolveAvatarUrl(person.avatar)}
                  alt={person.name}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid rgba(0,0,0,0.35)',
                  }}
                />
                <span>{person.name}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: isSelected ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.12)',
                    color: isSelected ? '#f8fafc' : '#cbd5e1',
                    fontWeight: 800,
                  }}
                >
                  {pPending > 0 ? `${pPending} left` : '✓'}
                </span>
              </button>
            );
          })}
        </div>

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
              <div
                className="user-chore-grid-screen"
                style={{
                  background: person.color || 'var(--section-background)',
                  borderRadius: 20,
                  padding: '14px 18px 18px',
                  boxShadow: '0 6px 26px rgba(0,0,0,0.25)',
                  color: '#0f172a',
                  marginBottom: 14,
                }}
              >
                {/* Compact Horizontal User Header Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#f8fafc',
                    padding: '10px 16px',
                    borderRadius: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={resolveAvatarUrl(person.avatar)}
                      alt={person.name}
                      onClick={() => handleOpenProfile(person)}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `3px solid ${person.color || '#60a5fa'}`,
                        cursor: 'pointer',
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>
                          {person.name}&apos;s Chores
                        </h3>
                        {streakCount > 0 && (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              background: 'rgba(249,115,22,0.2)',
                              color: '#fb923c',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontWeight: 800,
                            }}
                          >
                            🔥 {streakCount}d streak
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                          {doneToday} of {totalToday} completed today
                        </span>
                        {earnedBadges.length > 0 && (
                          <span style={{ fontSize: '0.95rem' }} title="Earned badges">
                            {earnedBadges.slice(0, 6).map((b) => b.emoji).join(' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress & Balance & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {totalToday > 0 && (
                      <div style={{ width: 140 }}>
                        <div
                          style={{
                            height: 10,
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #10b981, #059669)',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.74rem', textAlign: 'center', marginTop: 3, color: '#94a3b8' }}>
                          {remaining} remaining ({pct}%)
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        background: '#0f172a',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        padding: '6px 14px',
                        borderRadius: 12,
                        fontWeight: 900,
                        fontSize: '1.2rem',
                        color: '#fbbf24',
                      }}
                    >
                      {isCash ? `$${totalPts.toFixed(2)}` : `🏅 ${totalPts.toFixed(1)} pts`}
                    </div>

                    {availableExtraChores.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExtraModalPerson(person)}
                        style={{
                          padding: '8px 13px',
                          borderRadius: 10,
                          border: '1px solid rgba(52,211,153,0.45)',
                          background: 'rgba(16,185,129,0.2)',
                          color: '#6ee7b7',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fas fa-plus-circle" /> Extra Job
                      </button>
                    )}

                    <button
                      type="button"
                      style={{
                        padding: '8px 13px',
                        borderRadius: 10,
                        border: '1px solid rgba(96,165,250,0.45)',
                        background: 'rgba(59,130,246,0.22)',
                        color: '#93c5fd',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onClick={() => {
                        setNewAssignedTo(person.name);
                        setAddChoreModalOpen(true);
                      }}
                    >
                      <i className="fas fa-plus" /> Add Chore
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedChorePersonId(null)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid rgba(148,163,184,0.35)',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fas fa-columns" /> All Columns
                    </button>
                  </div>
                </div>

                {/* Multi-Column Compact Grid of Pending Chores */}
                {pendingChores.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(225px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {pendingChores.map((chore) => {
                      const isOverdue = overdueIds.has(chore.id) || Boolean(chore.is_overdue);
                      const daysLabel = formatDaysTag(chore.days_of_week);
                      return (
                        <div
                          key={chore.id}
                          className={`chore chore-compact-card${chore.due_datetime ? ' has-due-date' : ''}${chore.is_extra ? ' chore-extra' : ''}`}
                          style={{
                            margin: 0,
                            borderRadius: 14,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 10,
                            position: 'relative',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          }}
                        >
                          <div>
                            {/* Top row: Points Badge on Left + Icon & Title on Same Line + Delete / Days Tag */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                <span
                                  className="chore-points-badge"
                                  style={{
                                    position: 'static',
                                    fontSize: '1rem',
                                    fontWeight: 900,
                                    padding: '4px 9px',
                                    borderRadius: 10,
                                    background: isCash ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                                    border: `1px solid ${isCash ? 'rgba(34,197,94,0.45)' : 'rgba(245,158,11,0.45)'}`,
                                    color: isCash ? '#4ade80' : '#fbbf24',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    flexShrink: 0,
                                    margin: 0,
                                  }}
                                  title="Chore Points"
                                >
                                  {isCash ? (
                                    <span>${Number(chore.points).toFixed(2)}</span>
                                  ) : (
                                    <>
                                      <span>⭐</span>
                                      <span>{formatPoints(chore.points)}</span>
                                    </>
                                  )}
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                                  <span style={{ fontSize: '1.45rem', lineHeight: 1, flexShrink: 0 }}>
                                    {detectChoreIcon(chore.title, chore.icon)}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: '0.98rem',
                                      lineHeight: 1.25,
                                      color: 'var(--cr-text-primary, #fff)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {chore.title}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                {daysLabel && (
                                  <span className="chore-tag" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                    {daysLabel}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn-delete-chore-sm admin-only"
                                  style={{ position: 'static', width: 22, height: 22 }}
                                  onClick={() => setChoreToDelete(chore)}
                                  aria-label="Delete chore"
                                >
                                  <i className="fas fa-times" />
                                </button>
                              </div>
                            </div>

                            {chore.due_datetime && (
                              <div style={{ marginTop: 8, textAlign: 'left' }}>
                                <span
                                  className={`chore-tag ${isOverdue ? 'chore-tag-overdue' : 'chore-tag-due'}`}
                                  style={{ fontSize: '0.74rem' }}
                                >
                                  <i className="fas fa-clock" /> {isOverdue ? 'Overdue' : `Due ${chore.due_datetime}`}
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn-complete-chore"
                            style={{ minHeight: 38, padding: '8px 12px', fontSize: '0.95rem', borderRadius: 10 }}
                            onClick={() => handleCompleteChore(chore, person)}
                          >
                            <i className="fas fa-check" /> Complete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : completedChores.length > 0 ? (
                  <div className="all-done-banner" style={{ margin: '4px 0' }}>
                    <div className="all-done-emoji">🎉</div>
                    <div className="all-done-text">ALL DONE!</div>
                    <div className="all-done-subtext">Every chore for {person.name} is finished today!</div>
                  </div>
                ) : (
                  <div className="no-chores-banner" style={{ margin: '4px 0' }}>
                    <div className="no-chores-emoji">😊</div>
                    <div className="no-chores-text">FREE DAY!</div>
                    <div className="no-chores-subtext">No chores scheduled for {person.name} today</div>
                  </div>
                )}

                {/* Compact Completed Chores Pill Bar in Grid Mode */}
                {completedChores.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.15)' }}>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        marginBottom: 8,
                        color: 'rgba(15,23,42,0.75)',
                      }}
                    >
                      ✅ Completed Today ({completedChores.length}) — tap Undo if ticked by mistake:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {completedChores.map((chore) => (
                        <div
                          key={chore.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'rgba(15,23,42,0.82)',
                            color: '#f8fafc',
                            padding: '6px 12px',
                            borderRadius: 999,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                          }}
                        >
                          <i className="fas fa-check-circle" style={{ color: '#10b981' }} />
                          <span>{chore.title}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiPost('undo_complete_chore', { chore_id: chore.id });
                              await refresh();
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.14)',
                              border: 'none',
                              color: '#cbd5e1',
                              borderRadius: 999,
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            Undo
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  backgroundColor: person.color || undefined,
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
                    <img
                      src={resolveAvatarUrl(person.avatar)}
                      alt={person.name}
                      className="avatar avatar-tappable"
                      onClick={() => handleOpenProfile(person)}
                      title={`View ${person.name}'s badges`}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
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

                <h4
                  className="chores-to-do-header"
                  style={{
                    textAlign: 'center',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                    margin: '10px 0 4px',
                    padding: 0,
                  }}
                >
                  CHORES
                </h4>

                {/* Pending Chores */}
                {pendingChores.length > 0 ? (
                  <div className="chores-list incomplete-chores-list">
                    {pendingChores.map((chore) => {
                      const isOverdue = overdueIds.has(chore.id) || Boolean(chore.is_overdue);
                      const daysLabel = formatDaysTag(chore.days_of_week);
                      return (
                        <div
                          key={chore.id}
                          className={`chore chore-compact-card${chore.due_datetime ? ' has-due-date' : ''}${chore.is_extra ? ' chore-extra' : ''}`}
                          data-chore-id={chore.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            padding: '10px 12px',
                            borderRadius: 14,
                            position: 'relative',
                          }}
                        >
                          {/* Top Row: Points on left + Chore Icon & Title on same line + Right delete/days */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              {/* Prominent Points Badge */}
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  background: isCash ? 'rgba(34, 197, 94, 0.22)' : 'rgba(245, 158, 11, 0.22)',
                                  border: `1px solid ${isCash ? 'rgba(34, 197, 94, 0.45)' : 'rgba(245, 158, 11, 0.45)'}`,
                                  color: isCash ? '#4ade80' : '#fbbf24',
                                  fontWeight: 900,
                                  fontSize: '0.92rem',
                                  flexShrink: 0,
                                }}
                                title="Chore reward"
                              >
                                {isCash ? (
                                  <span>${Number(chore.points).toFixed(2)}</span>
                                ) : (
                                  <>
                                    <span style={{ fontSize: '0.82rem' }}>⭐</span>
                                    <span>{formatPoints(chore.points)}</span>
                                  </>
                                )}
                              </span>

                              {/* Chore Icon & Title on same line */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                                <span style={{ fontSize: '1.35rem', lineHeight: 1, flexShrink: 0 }}>
                                  {detectChoreIcon(chore.title, chore.icon)}
                                </span>
                                <span
                                  style={{
                                    fontWeight: 800,
                                    fontSize: '0.92rem',
                                    lineHeight: 1.25,
                                    color: 'var(--cr-text-primary, #fff)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {chore.title}
                                </span>
                              </div>
                            </div>

                            {/* Right tools: custom days tag & delete button (NO daily tag!) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              {daysLabel && (
                                <span className="chore-tag" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                                  {daysLabel}
                                </span>
                              )}
                              <button
                                type="button"
                                className="btn-delete-chore-sm admin-only"
                                style={{ position: 'static', width: 22, height: 22 }}
                                onClick={() => setChoreToDelete(chore)}
                                aria-label="Delete chore"
                              >
                                <i className="fas fa-times" />
                              </button>
                            </div>
                          </div>

                          {chore.due_datetime && (
                            <div style={{ textAlign: 'left' }}>
                              <span className={`chore-tag ${isOverdue ? 'chore-tag-overdue' : 'chore-tag-due'}`} style={{ fontSize: '0.72rem' }}>
                                <i className="fas fa-clock" /> {isOverdue ? 'Overdue' : `Due ${chore.due_datetime}`}
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            className="btn-complete-chore"
                            style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.88rem', borderRadius: 10 }}
                            onClick={() => handleCompleteChore(chore, person)}
                          >
                            <i className="fas fa-check" /> Complete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : completedChores.length > 0 ? (
                  <div className="all-done-banner">
                    <div className="all-done-emoji">🎉</div>
                    <div className="all-done-text">ALL DONE!</div>
                    <div className="all-done-subtext">Amazing work today!</div>
                  </div>
                ) : (
                  <div className="no-chores-banner">
                    <div className="no-chores-emoji">😊</div>
                    <div className="no-chores-text">FREE DAY!</div>
                    <div className="no-chores-subtext">No chores today</div>
                  </div>
                )}

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

                {/* Collapsible Completed Chores Section */}
                {completedChores.length > 0 && (
                  <div className="completed-chores-toggle-container" style={{ marginTop: 15 }}>
                    <button
                      type="button"
                      className="completed-chores-toggle-btn"
                      onClick={() =>
                        setExpandedCompleted((prev) => ({ ...prev, [person.id]: !prev[person.id] }))
                      }
                      aria-label="Show/Hide Completed Chores"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.1em',
                        color: 'var(--text-color)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <i
                        className="fas fa-chevron-down"
                        style={{
                          transition: 'transform 0.2s',
                          transform: expandedCompleted[person.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      />
                      <span style={{ marginLeft: 6 }}>
                        {expandedCompleted[person.id] ? 'Hide' : 'Show'} Completed Chores ({completedChores.length})
                      </span>
                    </button>

                    {expandedCompleted[person.id] && (
                      <div className="chores-list completed-chores-list">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 className="chores-completed-header" style={{ color: 'var(--text-color)', marginTop: 0 }}>
                            Completed Chores:
                          </h4>
                          <button
                            type="button"
                            className="clear-all-completed-btn admin-only"
                            style={{
                              background: '#f44336',
                              color: '#fff',
                              border: 'none',
                              padding: '6px 16px',
                              borderRadius: 6,
                              fontSize: '0.95em',
                              cursor: 'pointer',
                              marginBottom: 6,
                            }}
                            onClick={() => handleClearCompleted(person.name)}
                          >
                            <i className="fas fa-trash" /> Clear All
                          </button>
                        </div>
                        <div
                          className="clear-all-hint admin-only"
                          style={{ fontSize: '0.95em', color: 'var(--cr-text-secondary)', marginBottom: 6 }}
                        >
                          (clears this list for today)
                        </div>
                        {completedChores.map((chore) => (
                          <div
                            key={chore.id}
                            className="chore completed"
                            data-chore-id={chore.id}
                            style={{
                              margin: 8,
                              borderRadius: 14,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                              opacity: 0.72,
                              paddingRight: 34,
                            }}
                          >
                            <button
                              type="button"
                              className="btn-delete-chore-sm admin-only"
                              onClick={() => setChoreToDelete(chore)}
                              aria-label="Delete chore"
                            >
                              <i className="fas fa-times" />
                            </button>
                            <div className="chore-header">
                              <span className="chore-icon">
                                <i className="fas fa-check-circle" style={{ color: '#10b981' }} />
                              </span>
                              <span className="chore-title" style={{ fontSize: '0.95em' }}>
                                {chore.title}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  type="button"
                                  className="btn-undo-chore"
                                  onClick={async () => {
                                    await apiPost('undo_complete_chore', { chore_id: chore.id });
                                    await refresh();
                                  }}
                                  title="Mark as not done (takes the points back)"
                                  aria-label="Undo completion"
                                >
                                  <i className="fas fa-undo" /> Undo
                                </button>
                                <span style={{ fontSize: '0.78em', color: '#94a3b8' }}>✓ Today</span>
                              </span>
                              <span className="chore-points-badge" title="Points for this chore">
                                {isCash ? (
                                  <>
                                    <i className="fas fa-money-bill-wave" />
                                    <span className="chore-points-value">${Number(chore.points).toFixed(2)}</span>
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-award" />
                                    <span className="chore-points-value">{Number(chore.points).toFixed(1)}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* + Add Chore tile */}
                <button
                  type="button"
                  className="chore-kanban-add-btn"
                  onClick={() => {
                    setNewAssignedTo(person.name);
                    setAddChoreModalOpen(true);
                  }}
                >
                  <i className="fas fa-plus" /> Add Chore
                </button>

                {/* Drag handle for Kanban column */}
                <div className="column-footer">
                  <span
                    className="drag-handle"
                    title="Hold and drag to reorder columns"
                    draggable
                    onDragStart={() => setDraggedPersonId(person.id)}
                    onDragEnd={() => setDraggedPersonId(null)}
                  >
                    <i className="fas fa-grip-vertical" />
                    <span className="drag-handle-label">Hold to reorder</span>
                    <i className="fas fa-grip-vertical" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </section>

      {/* ADD CHORE MODAL */}
      <Modal
        open={addChoreModalOpen}
        onClose={() => setAddChoreModalOpen(false)}
        title="Add Chore"
        icon="fas fa-tasks"
        maxWidth={580}
        footer={
          <>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setAddChoreModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submittingChore}
              onClick={(e) => handleAddChoreSubmit(e as any)}
            >
              <i className="fas fa-plus" /> {submittingChore ? 'Adding...' : 'Add Chore'}
            </button>
          </>
        }
      >
        {/* Quick Suggestions Chips */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', fontWeight: 700 }}>
              Quick Suggestions
            </span>
            <button
              type="button"
              className="btn-suggestion-add"
              title="Add a new chore suggestion"
              onClick={() => setShowAddSuggestionInput((p) => !p)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              <i className="fas fa-pencil-alt" />
            </button>
          </div>
          {showAddSuggestionInput && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Add chore suggestion..."
                className="modern-input"
                style={{ height: 32, fontSize: '0.82rem' }}
                value={newSuggestionText}
                onChange={(e) => setNewSuggestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newSuggestionText.trim();
                    if (trimmed && !choreSuggestions.includes(trimmed)) {
                      saveSuggestions([...choreSuggestions, trimmed]);
                    }
                    setNewSuggestionText('');
                    setShowAddSuggestionInput(false);
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '4px 10px', height: 32, fontSize: '0.8rem' }}
                onClick={() => {
                  const trimmed = newSuggestionText.trim();
                  if (trimmed && !choreSuggestions.includes(trimmed)) {
                    saveSuggestions([...choreSuggestions, trimmed]);
                  }
                  setNewSuggestionText('');
                  setShowAddSuggestionInput(false);
                }}
              >
                Add
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto' }}>
            {choreSuggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                className="chore-suggestion-chip"
                onClick={() => setNewTitle(s)}
                style={{ fontSize: '0.78rem', padding: '4px 9px' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Add Chore Form */}
        <form id="add-chore-form" onSubmit={handleAddChoreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="chore-field-group">
            <label className="chore-field-label" htmlFor="chore-title-input">
              <i className="fas fa-tag" /> Chore Title
            </label>
            <input
              id="chore-title-input"
              type="text"
              name="title"
              placeholder="e.g. Clean your room, Pack lunch..."
              className="modern-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="chore-field-group" style={{ flex: '0 0 130px' }}>
              <label className="chore-field-label" htmlFor="points-input">
                {isCash ? (
                  <>
                    <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} /> Cash ($)
                  </>
                ) : (
                  <>
                    <i className="fas fa-star" style={{ color: '#fbbf24' }} /> Points
                  </>
                )}
              </label>
              <input
                type="number"
                id="points-input"
                name="points"
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                min="0"
                step={isCash ? '0.01' : '0.5'}
                className="modern-input"
                required
              />
            </div>

            <div className="chore-field-group" style={{ flex: '1 1 200px' }}>
              <label className="chore-field-label">
                <i className="fas fa-user-circle" /> Assign to
              </label>
              <div className="chore-assign-pills" id="assigned-to-btn-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {family.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={`chore-assign-pill assigned-to-btn${selectedAssignee === person.name ? ' selected' : ''}`}
                    onClick={() => setNewAssignedTo(person.name)}
                    style={{ padding: '5px 12px', fontSize: '0.84rem' }}
                  >
                    <span className="pill-avatar">{person.name.slice(0, 1).toUpperCase()}</span>
                    <span className="pill-name">{person.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Repeating row */}
          <div className="chore-field-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="chore-field-label" style={{ margin: 0 }}>
                <i className="fas fa-sync-alt" style={{ color: '#60a5fa' }} /> Repeating Chore
              </label>
              <label className="chore-toggle-wrap">
                <input
                  type="checkbox"
                  checked={isRepeating}
                  onChange={(e) => {
                    setIsRepeating(e.target.checked);
                    if (!e.target.checked) setNewDaysOfWeek([]);
                  }}
                  className="chore-toggle-input"
                />
                <span className="chore-toggle-track">
                  <span className="chore-toggle-thumb" />
                </span>
                <span className="chore-toggle-label">{isRepeating ? 'On' : 'Off'}</span>
              </label>
            </div>
          </div>

          {/* Days of week */}
          {isRepeating && (
            <div className="chore-days-row">
              <label className="chore-field-label">
                <i className="fas fa-calendar-day" /> Which days{' '}
                <span className="chore-days-hint">(leave all unchecked for every day)</span>
              </label>
              <div className="chore-day-pills">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <label key={day} className="chore-day-pill">
                    <input
                      type="checkbox"
                      checked={newDaysOfWeek.includes(day)}
                      onChange={() => toggleDayOfWeek(day)}
                      className="day-checkbox"
                    />
                    <span>{day.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Due date/time */}
          <div className="chore-due-row">
            <div className="chore-due-toggle-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="chore-field-label" style={{ margin: 0 }}>
                <i className="fas fa-clock" style={{ color: '#f87171' }} /> Set due date &amp; time{' '}
                <span className="optional-label">(optional)</span>
              </span>
              <label className="chore-toggle-wrap">
                <input
                  type="checkbox"
                  checked={hasDueDatetime}
                  onChange={(e) => setHasDueDatetime(e.target.checked)}
                  className="chore-toggle-input"
                />
                <span className="chore-toggle-track">
                  <span className="chore-toggle-thumb" />
                </span>
              </label>
            </div>
            {hasDueDatetime && (
              <div style={{ marginTop: 6 }}>
                <input
                  type="datetime-local"
                  value={newDueDatetime}
                  onChange={(e) => setNewDueDatetime(e.target.value)}
                  className="modern-input modern-datetime"
                />
                <p className="chore-due-warning" style={{ fontSize: '0.74rem', color: '#f87171', margin: '4px 0 0' }}>
                  No points will be awarded if completed after the due date
                </p>
              </div>
            )}
          </div>

          {/* Emoji icon picker */}
          <div className="chore-field-group">
            <label className="chore-field-label">
              <i className="fas fa-face-smile" /> Icon{' '}
              <span className="optional-label">(optional — auto-detected if blank)</span>
            </label>
            <div className="chore-emoji-picker-wrap">
              <button
                type="button"
                className="chore-emoji-preview-btn"
                title="Click to choose an icon"
                onClick={() => setEmojiPickerOpen((p) => !p)}
              >
                <span>{newIcon || '✅'}</span>
                <i className="fas fa-chevron-down" style={{ fontSize: '0.65em', marginLeft: 4, opacity: 0.6 }} />
              </button>
              {emojiPickerOpen && (
                <div className="chore-emoji-grid" style={{ display: 'flex' }}>
                  {CHORE_EMOJI_OPTIONS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chore-emoji-opt"
                      onClick={() => {
                        setNewIcon(emoji);
                        setEmojiPickerOpen(false);
                      }}
                    >
                      {emoji || 'Auto ✨'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* EDIT NAME MODAL */}
      {editingPersonModal && (
        <div
          id="edit-name-modal"
          style={{
            display: 'flex',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'var(--cr-modal-overlay)',
            zIndex: 9999,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => setEditingPersonModal(null)}
        >
          <div
            style={{
              background: 'var(--cr-modal-surface)',
              padding: '32px 24px',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              minWidth: 320,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'var(--cr-text-primary)', margin: '0 0 12px' }}>Edit Name</h3>
            <input
              type="text"
              value={editingNameVal}
              onChange={(e) => setEditingNameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') setEditingPersonModal(null);
              }}
              autoFocus
              placeholder="Enter new name"
              style={{
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--cr-subtle-panel-border)',
                background: 'var(--cr-subtle-panel)',
                color: 'var(--cr-text-primary)',
                width: '80%',
                marginBottom: 18,
                outline: 'none',
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                type="button"
                className="confirm-btn"
                onClick={handleSaveName}
                style={{
                  background: '#2d2d2d',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setEditingPersonModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / SKIP CHORE MODAL */}
      {choreToDelete && (
        <div
          style={{
            display: 'flex',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'var(--cr-modal-overlay)',
            zIndex: 9999,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => setChoreToDelete(null)}
        >
          <div
            style={{
              background: 'var(--cr-modal-surface)',
              padding: '32px 24px',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              minWidth: 320,
              maxWidth: 440,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.5em', marginBottom: 10 }}>
              <i className="fas fa-trash-alt" style={{ color: '#e53935' }} />
            </div>
            <div style={{ fontSize: '1.15em', marginBottom: 22, color: 'var(--cr-text-primary)' }}>
              {choreToDelete.is_daily || choreToDelete.days_of_week
                ? 'Do you want to delete this daily chore permanently, or just for today?'
                : 'Are you sure you want to delete this chore?'}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleDeleteChore(choreToDelete, true)}
                style={{
                  background: '#e53935',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {choreToDelete.is_daily || choreToDelete.days_of_week ? 'Delete Permanently' : 'Delete'}
              </button>
              {(choreToDelete.is_daily || choreToDelete.days_of_week) && (
                <button
                  type="button"
                  onClick={() => handleDeleteChore(choreToDelete, false)}
                  style={{
                    background: '#fbc02d',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete for Today
                </button>
              )}
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setChoreToDelete(null)}
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
            background: 'var(--cr-modal-overlay)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setExtraModalPerson(null)}
        >
          <div
            style={{
              background: 'var(--cr-modal-surface)',
              maxWidth: 520,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
              borderRadius: 18,
              color: 'var(--cr-text-primary)',
            }}
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
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
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
                      Pick Job
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
          id="profile-modal-overlay"
          onClick={() => setProfileModalPerson(null)}
          style={{
            display: 'flex',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'var(--cr-modal-overlay)',
            zIndex: 99990,
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflowY: 'auto',
            boxSizing: 'border-box',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--cr-modal-surface)',
              borderRadius: 20,
              maxWidth: 500,
              width: '100%',
              margin: 'auto',
              position: 'relative',
              boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            }}
          >
            <button
              type="button"
              onClick={() => setProfileModalPerson(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 14,
                background: 'var(--cr-subtle-panel)',
                border: 'none',
                color: 'var(--cr-text-primary)',
                fontSize: '1.5em',
                width: 38,
                height: 38,
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 1,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
            <div id="profile-modal-content" style={{ padding: '28px 20px 36px', color: 'var(--cr-text-primary)' }}>
              {(() => {
                const pColor = profileModalPerson.color || '#555';
                const totalPts = Number((profileModalPerson.points || 0) + (profileModalPerson.bonus_points || 0));
                const streak = profileDetails?.streak?.current_streak ?? profileModalPerson.streak?.current_streak ?? 0;
                const bestStreak = profileDetails?.streak?.longest_streak ?? profileModalPerson.streak?.longest_streak ?? 0;
                const totalDone = profileDetails?.total_completed ?? profileModalPerson.total_completed ?? 0;
                const allBadges = profileDetails?.badges || data.badge_definitions || [];
                const earnedCount = allBadges.filter((b) => b.earned).length;

                return (
                  <>
                    <div
                      className="profile-hero"
                      style={{ background: `${pColor}22`, border: `2px solid ${pColor}` }}
                    >
                      <img
                        src={resolveAvatarUrl(profileModalPerson.avatar)}
                        alt={profileModalPerson.name}
                        className="profile-avatar"
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
                    <h2 className="profile-section-title" style={{ marginTop: 20 }}>
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
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
