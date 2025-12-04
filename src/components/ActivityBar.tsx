'use client';

import React from 'react';

interface ActivityBarProps {
  activeView: 'explorer' | 'data-structures';
  onViewChange: (view: 'explorer' | 'data-structures') => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange }) => {
  const activities = [
    {
      id: 'explorer' as const,
      icon: '📁',
      label: 'Explorer',
      title: 'File Explorer',
    },
    {
      id: 'data-structures' as const,
      icon: '🔧',
      label: 'Data Structures',
      title: 'Kernel Data Structures',
    },
  ];

  return (
    <div className="cursor-activity-bar">
      {activities.map((activity) => (
        <button
          key={activity.id}
          className={`cursor-activity-item ${activeView === activity.id ? 'active' : ''}`}
          onClick={() => onViewChange(activity.id)}
          title={activity.title}
          aria-label={activity.title}
        >
          <span className="cursor-activity-icon">{activity.icon}</span>
          <span className="cursor-activity-label">{activity.label}</span>
          {activeView === activity.id && <span className="cursor-activity-indicator" />}
        </button>
      ))}
    </div>
  );
};

export default ActivityBar;
