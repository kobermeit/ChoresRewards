import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { WipBanner } from './ui';

export const SectionHelpTip: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={text}
        aria-label="Section Help"
        style={{
          width: 22,
          height: 22,
          minHeight: 0,
          padding: 0,
          borderRadius: '50%',
          border: '1px solid rgba(148,163,184,0.35)',
          background: open ? 'rgba(59,130,246,0.3)' : 'rgba(148,163,184,0.12)',
          color: open ? '#93c5fd' : '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 250,
            maxWidth: 320,
            background: '#0f172a',
            border: '1px solid rgba(96,165,250,0.45)',
            borderRadius: 12,
            padding: '10px 14px',
            color: '#e2e8f0',
            fontSize: '0.8rem',
            fontWeight: 500,
            lineHeight: 1.45,
            boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
            zIndex: 9500,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
};

export const HelpView: React.FC = () => {
  const { setActiveView } = useApp();

  const sections = [
    {
      icon: '🏠',
      title: 'Family Members Chores & User Grid View',
      color: '#4ade80',
      tips: [
        'Use the family filter pills at the top of the Chores section (All Family, or tap a person\'s name) to switch between the side-by-side columns and a focused, no-scroll grid of that person\'s chores.',
        'You can also tap any person\'s row in "Today\'s Tasks" or their column header to jump straight to their focused chore grid.',
        'Daily chores automatically reset at Midnight (12:00 AM) in your household timezone (configurable in Settings → General & Reset).',
        'When a child finishes all their daily chores, they unlock the Celebration screen where they can pick a Brain Quiz or Body Challenge for bonus points!',
        'Want to earn extra points? Tap "+ Pick an extra job" under a family member\'s column to claim age-appropriate bonus chores.',
      ],
    },
    {
      icon: '🍴',
      title: 'Weekly Meal Planner & Recipe Library',
      color: '#fb923c',
      tips: [
        'Each day of the week is a Kanban column — add as many meal cards per day as you need (e.g. one tile for Kids\' Dinner and another for Adults\' Dinner).',
        'Tap "+ Add Meal" on any day to pick a recipe, tag who it\'s for (Everyone, Kids, Adults, or a specific person), and check multiple days (e.g. Monday & Tuesday) if you\'re cooking once for multiple nights!',
        'Tap any planned meal tile to open its full Recipe Card with photo, ingredients list, and step-by-step cooking instructions.',
        'When a meal in your Meal Library has ingredients saved, planning it for the week automatically adds those ingredients to your Shopping List grouped by supermarket.',
        'You can import recipes from Notion in Settings or POST recipes directly to /api/recipes/import from Google Apps Script / Discord.',
      ],
    },
    {
      icon: '🛒',
      title: 'Smart Shopping List',
      color: '#38bdf8',
      tips: [
        'Type into the Smart Search box to filter your item catalog (case-insensitive and space-insensitive, so "papertowel" matches "Paper Towel"). Tap a match to add it immediately, or press Enter to create a new item.',
        'Tap "⭐ Frequently Added" to quickly tick off staples (milk, bread, eggs) that you buy most often.',
        'Tap "💡 Suggested" to see items the app predicts you may need soon based on your historical purchase interval (e.g. every 2 weeks or every month).',
        'Use "👁️ Hide Checked" while shopping to keep your screen clean.',
        'When you finish shopping, tap "📦 Archive Checked (Purchased)" — this moves ticked items off the active list into "🕒 Recently Purchased" and records the purchase timestamp to improve future suggestions.',
      ],
    },
    {
      icon: '🏆',
      title: 'Rewards & Pocket Money',
      color: '#a78bfa',
      tips: [
        'Switch between Points (⭐) and Cash / Pocket Money (💵) anytime in Settings → Setup Wizard.',
        'When a family member has enough points/cash, their Redeem button lights up green.',
        'Unlock Adult Mode (🔒 icon in the top bar or side nav) to create rewards, adjust points, or edit chores.',
      ],
    },
    {
      icon: '📂',
      title: 'Organise (Vehicles, Rego & Household Bills)',
      color: '#f472b6',
      tips: [
        'Unlocked in Adult Mode: track family vehicles, odometer readings, service logbooks, rego expiry, insurance, and recurring bills.',
        'Items due within 30 days automatically appear as a reminder banner at the top of the dashboard.',
      ],
    },
  ];

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>❓ Help & Household Guide</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: '0.9rem' }}>
            Quick tips and instructions for every section of Chores & Rewards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="btn-primary"
          style={{ padding: '8px 18px', borderRadius: 10 }}
        >
          ← Back to Dashboard
        </button>
      </div>
      <WipBanner />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {sections.map((sec) => (
          <div
            key={sec.title}
            className="card"
            style={{
              padding: 22,
              borderRadius: 18,
              borderTop: `4px solid ${sec.color}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{sec.icon}</span>
              <span>{sec.title}</span>
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sec.tips.map((tip, i) => (
                <li key={i} style={{ fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--cr-text-secondary)' }}>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
