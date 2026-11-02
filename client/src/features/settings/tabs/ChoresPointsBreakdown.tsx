import React from 'react';
import { Person } from '../../../types';
import { MemberWeeklyPotential, formatPoints, pointsToCash } from '../choreWeeklyPoints';

interface ChoresPointsBreakdownProps {
  person: Person;
  potential: MemberWeeklyPotential;
  /** True when the household uses cash rewards (dollars emphasised on each line). */
  showCash: boolean;
  pointValue: number;
  rewardSystem: 'points' | 'cash';
}

/**
 * Per-chore detail behind one member's weekly potential: "Reading 5 pts × 5 (Mon–Fri)
 * = 25 pts / week". This is the answer to "where does the 70 come from?".
 */
export const ChoresPointsBreakdown: React.FC<ChoresPointsBreakdownProps> = ({
  person,
  potential,
  showCash,
  pointValue,
  rewardSystem,
}) => {
  const accent = person.color || 'var(--color-primary)';

  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 14px',
        borderRadius: 'var(--card-radius, 14px)',
        background: 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${person.color || 'rgba(255,255,255,0.14)'}44`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <strong style={{ fontSize: '0.92rem' }}>{person.name}&apos;s weekly breakdown</strong>
        <strong style={{ fontSize: '0.92rem', color: accent }}>
          {formatPoints(potential.weeklyPoints)} / week
          {showCash ? ` · ${pointsToCash(potential.weeklyPoints, pointValue)}` : ''}
        </strong>
      </div>

      {potential.lines.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>
          No chores worth points are assigned to {person.name} yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {potential.lines.map((line) => (
            <div
              key={line.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                fontSize: '0.84rem',
                padding: '3px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span aria-hidden="true">{line.icon || '🧹'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {line.title}
                </span>
                <span style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {`${formatPoints(line.pointsPerDay)} × ${line.daysPerWeek} (${line.schedule})`}
                </span>
              </span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatPoints(line.weeklyPoints)}
                {rewardSystem === 'cash' && showCash && (
                  <span style={{ opacity: 0.65, fontWeight: 600 }}>
                    {` · ${pointsToCash(line.weeklyPoints, pointValue)}`}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChoresPointsBreakdown;
