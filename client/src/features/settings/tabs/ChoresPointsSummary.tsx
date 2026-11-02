import React, { useMemo } from 'react';
import { Button } from '../../../components/ui';
import { Chore, Person } from '../../../types';
import { computeWeeklyPotential, formatPoints, pointsToCash } from '../choreWeeklyPoints';
import { ChoresPointsBreakdown } from './ChoresPointsBreakdown';

interface ChoresPointsSummaryProps {
  family: Person[];
  /** Full chore catalog (already filtered by `?all=1`). */
  chores: Chore[];
  rewardSystem: 'points' | 'cash';
  pointValue: number;
  /** 'all' or a member name — drives both the pills and the catalog filter. */
  selected: string;
  onSelect: (value: string) => void;
}

/**
 * Member pills showing "current balance / weekly potential" for the All Chores
 * catalog, plus a per-chore breakdown for the selected member.
 *
 * "Weekly potential" = everything they could earn from Monday to Sunday if they
 * completed every scheduled chore. Bonus points and the extra bonus pool are
 * deliberately excluded so the number is a floor they can rely on.
 */
export const ChoresPointsSummary: React.FC<ChoresPointsSummaryProps> = ({
  family,
  chores,
  rewardSystem,
  pointValue,
  selected,
  onSelect,
}) => {
  const potentials = useMemo(
    () => family.map((person) => ({ person, potential: computeWeeklyPotential(chores, person.name) })),
    [family, chores]
  );

  const cash = Number(pointValue) > 0;
  const selectedPotential = potentials.find((entry) => entry.person.name === selected);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {potentials.map(({ person, potential }) => {
          const isActive = selected === person.name;
          return (
            <Button
              key={person.id}
              variant={isActive ? 'primary' : 'secondary'}
              size="sm"
              shape="pill"
              onClick={() => onSelect(isActive ? 'all' : person.name)}
              aria-pressed={isActive}
              title={
                cash
                  ? `${person.name}: ${formatPoints(person.points)} now, up to ${formatPoints(
                      potential.weeklyPoints
                    )} a week (${pointsToCash(potential.weeklyPoints, pointValue)})`
                  : `${person.name}: ${formatPoints(person.points)} now, up to ${formatPoints(
                      potential.weeklyPoints
                    )} a week`
              }
              style={{ paddingInline: 12 }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: person.color || 'var(--color-primary)',
                    boxShadow: `0 0 6px ${person.color || 'var(--color-primary)'}`,
                    flex: '0 0 auto',
                  }}
                />
                <span style={{ fontWeight: 700 }}>{person.name}</span>
                <span style={{ opacity: 0.85, fontWeight: 600 }}>
                  {formatPoints(person.points)} / {formatPoints(potential.weeklyPoints)}
                </span>
                {cash && (
                  <span style={{ opacity: 0.75, fontWeight: 600, fontSize: '0.8em' }}>
                    {pointsToCash(potential.weeklyPoints, pointValue)}
                  </span>
                )}
              </span>
            </Button>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: '0.78rem', opacity: 0.65 }}>
        Balance now / earnable this week if every chore is done Mon–Sun (bonus points excluded).
      </div>

      {selectedPotential && (
        <ChoresPointsBreakdown
          person={selectedPotential.person}
          potential={selectedPotential.potential}
          showCash={cash}
          pointValue={pointValue}
          rewardSystem={rewardSystem}
        />
      )}
    </div>
  );
};

export default ChoresPointsSummary;
