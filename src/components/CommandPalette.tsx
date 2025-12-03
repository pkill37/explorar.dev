'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

interface Command {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => 
    commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.category?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [commands, searchQuery]
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setSearchQuery('');
        setSelectedIndex(0);
      }, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, onClose, filteredCommands]);

  if (!isOpen) return null;

  return (
    <div className="cursor-command-palette-overlay" onClick={onClose}>
      <div className="cursor-command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cursor-command-palette-header">
          <input
            ref={inputRef}
            type="text"
            className="cursor-command-palette-input"
            placeholder="Type a command..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>
        <div className="cursor-command-palette-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="cursor-command-palette-empty">
              No commands found
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                className={`cursor-command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  command.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {command.icon && (
                  <span className="cursor-command-palette-icon">{command.icon}</span>
                )}
                <span className="cursor-command-palette-label">{command.label}</span>
                {command.category && (
                  <span className="cursor-command-palette-category">{command.category}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

