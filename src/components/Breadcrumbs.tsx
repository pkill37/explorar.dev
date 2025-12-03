'use client';

import React from 'react';

interface BreadcrumbsProps {
  path: string;
  onPathClick?: (path: string) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, onPathClick }) => {
  if (!path) return null;

  const segments = path.split('/').filter(Boolean);
  
  const handleClick = (index: number) => {
    if (onPathClick) {
      const clickedPath = segments.slice(0, index + 1).join('/');
      onPathClick(clickedPath);
    }
  };

  return (
    <div className="cursor-breadcrumbs">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const segmentPath = segments.slice(0, index + 1).join('/');
        
        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="cursor-breadcrumb-separator">/</span>
            )}
            <span
              className={`cursor-breadcrumb-item ${isLast ? 'active' : ''} ${onPathClick ? 'clickable' : ''}`}
              onClick={() => !isLast && handleClick(index)}
              title={segmentPath}
            >
              {segment}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumbs;

