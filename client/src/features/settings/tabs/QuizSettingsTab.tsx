import React from 'react';
import { useApp } from '../../../context/AppContext';
import { apiPost } from '../../../api';

export const QuizSettingsTab: React.FC = () => {
  const { data, refresh } = useApp();

  return (
    <div className="card" style={{ padding: 24, borderRadius: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>🧠 Daily Brain Quiz Questions ({data?.quiz_questions?.length || 0})</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(data?.quiz_questions_enabled)}
            onChange={async (e) => {
              await apiPost('save_quiz_settings', { quiz_questions_enabled: e.target.checked });
              await refresh();
            }}
          />
          Enable Daily Quiz on All-Done Celebration
        </label>
      </div>
      <p style={{ opacity: 0.75, fontSize: '0.88rem' }}>
        Age-matched questions shown when a child finishes all their daily chores.
      </p>
    </div>
  );
};

export default QuizSettingsTab;
