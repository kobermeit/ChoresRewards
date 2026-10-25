import React from 'react';
import { Person } from '../../types';
import { Select } from './Input';
import { UserAvatar } from './UserAvatar';

export interface AssigneeSelectProps {
  value: string;
  onChange: (value: string, personId?: number | null) => void;
  family: Person[];
  label?: string;
  required?: boolean;
  allowGroups?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export const AssigneeSelect: React.FC<AssigneeSelectProps> = ({
  value,
  onChange,
  family,
  label = 'Assign To',
  required = false,
  allowGroups = true,
  disabled = false,
  helperText,
}) => {
  const selectedPerson = family.find((p) => p.name === value);
  const isKidsGroup = value === 'Kids' || value === 'kids';
  const isParentsGroup = value === 'Parents' || value === 'parents' || value === 'Adults';
  const isEveryone = !value || value === 'Everyone' || value === 'All';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <Select
        label={label}
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          const matched = family.find((p) => p.name === val);
          onChange(val, matched?.id ?? null);
        }}
        required={required}
        disabled={disabled}
        helperText={helperText}
      >
        {allowGroups && (
          <optgroup label="Groups">
            <option value="Everyone">🌟 Everyone (All Family)</option>
            <option value="Kids">🧒 Kids (All Children)</option>
            <option value="Parents">👨‍👩‍👧 Parents / Adults</option>
          </optgroup>
        )}
        <optgroup label="Individual Members">
          {family.map((person) => (
            <option key={person.id} value={person.name}>
              {person.name} ({person.role === 'parent' ? 'Parent' : 'Child'})
            </option>
          ))}
        </optgroup>
      </Select>

      {/* Selected Assignee Feedback Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 'var(--radius-pill, 999px)',
          background: selectedPerson
            ? `${selectedPerson.color || '#3b82f6'}1a`
            : isKidsGroup
            ? 'rgba(245, 158, 11, 0.12)'
            : isParentsGroup
            ? 'rgba(59, 130, 246, 0.12)'
            : 'rgba(168, 85, 247, 0.12)',
          border: `1px solid ${
            selectedPerson
              ? `${selectedPerson.color || '#3b82f6'}40`
              : isKidsGroup
              ? 'rgba(245, 158, 11, 0.3)'
              : isParentsGroup
              ? 'rgba(59, 130, 246, 0.3)'
              : 'rgba(168, 85, 247, 0.3)'
          }`,
          width: 'fit-content',
          marginTop: -2,
        }}
      >
        {selectedPerson ? (
          <>
            <UserAvatar
              avatar={selectedPerson.avatar}
              name={selectedPerson.name}
              color={selectedPerson.color}
              size={18}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
              Assigned to {selectedPerson.name}
            </span>
          </>
        ) : isKidsGroup ? (
          <>
            <span style={{ fontSize: '0.9rem' }}>🧒</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fef3c7' }}>
              Available to all kids
            </span>
          </>
        ) : isParentsGroup ? (
          <>
            <span style={{ fontSize: '0.9rem' }}>👨‍👩‍👧</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dbeafe' }}>
              Available to all parents
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.9rem' }}>🌟</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f3e8ff' }}>
              Available to everyone in household
            </span>
          </>
        )}
      </div>
    </div>
  );
};
