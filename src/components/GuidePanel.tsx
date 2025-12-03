"use client";
import React, { useState } from "react";

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface GuidePanelProps {
  title?: string;
  sections: Section[];
  defaultOpenIds?: string[];
  onNavigateFile?: (path: string) => void;
  overallProgress?: number;
  chapterProgress?: Record<string, boolean>; // chapterId -> isCompleted
}

export default function GuidePanel({ 
  sections, 
  defaultOpenIds = [],
  overallProgress = 0,
  chapterProgress = {}
}: GuidePanelProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map(s => [s.id, defaultOpenIds.includes(s.id)]))
  );

  const toggle = (id: string) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="vscode-panel-content">
      {/* Overall Progress Bar */}
      {overallProgress > 0 && (
        <div className="guide-progress-container">
          <div className="guide-progress-header">
            <span className="guide-progress-label">Overall Progress</span>
            <span className="guide-progress-percentage">{overallProgress}%</span>
          </div>
          <div className="guide-progress-bar">
            <div 
              className="guide-progress-fill"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Chapter Sections */}
      {sections.map((s) => {
        const isCompleted = chapterProgress[s.id] || false;
        
        return (
          <div key={s.id} className="vscode-guide-section">
            <div 
              className="vscode-guide-header"
              onClick={() => toggle(s.id)}
            >
              <span className="guide-expand-icon">{open[s.id] ? "▾" : "▸"}</span>
              <span className="guide-title-text">{s.title}</span>
              {isCompleted && (
                <span className="guide-completion-badge" title="Quiz completed">
                  ✓
                </span>
              )}
            </div>
            {open[s.id] && (
              <div className="vscode-guide-content">
                {s.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
