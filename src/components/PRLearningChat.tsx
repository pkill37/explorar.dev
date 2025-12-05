'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { PullRequest, PullRequestFile, PullRequestDiff } from '@/types';

interface PRLearningChatProps {
  pr: PullRequest;
  files: PullRequestFile[];
  selectedFile: string | null;
  diffs: Map<string, PullRequestDiff>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

let messageIdCounter = 1;

export default function PRLearningChat({ pr, files, selectedFile, diffs }: PRLearningChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: String(messageIdCounter++),
      role: 'assistant',
      content: `👋 Welcome! I'm here to help you understand PR #${pr.number}: "${pr.title}".\n\nI can help you:\n• Understand what this PR changes\n• Explain specific code changes\n• Answer questions about the implementation\n• Guide you through complex parts\n\nWhat would you like to learn about?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: String(messageIdCounter++),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (in a real implementation, this would call an AI API)
    setTimeout(() => {
      const response = generateResponse(userMessage.content, pr, files, selectedFile, diffs);
      const assistantMessage: Message = {
        id: String(messageIdCounter++),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    'What does this PR do?',
    'What are the main changes?',
    'Explain the most complex part',
    'Are there any potential issues?',
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--vscode-editor-background)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--vscode-border)',
          background: 'var(--vscode-editor-background)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
          PR Learning Assistant
        </div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          #{pr.number}: {pr.title}
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: '12px',
                background:
                  message.role === 'user'
                    ? 'var(--vscode-textLink-foreground)'
                    : 'var(--vscode-textCodeBlock-background)',
                color:
                  message.role === 'user'
                    ? 'var(--vscode-editor-background)'
                    : 'var(--vscode-foreground)',
                fontSize: '13px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}
            >
              {message.content}
            </div>
            <div
              style={{
                fontSize: '10px',
                opacity: 0.5,
                marginTop: '4px',
                padding: '0 4px',
              }}
            >
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--vscode-textCodeBlock-background)',
                fontSize: '13px',
              }}
            >
              <span style={{ opacity: 0.7 }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--vscode-border)',
            background: 'var(--vscode-textCodeBlock-background)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '11px', opacity: 0.7, width: '100%', marginBottom: '4px' }}>
            Quick questions:
          </div>
          {quickQuestions.map((question, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickQuestion(question)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: '1px solid var(--vscode-border)',
                background: 'var(--vscode-editor-background)',
                color: 'var(--vscode-foreground)',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
                e.currentTarget.style.borderColor = 'var(--vscode-textLink-foreground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--vscode-editor-background)';
                e.currentTarget.style.borderColor = 'var(--vscode-border)';
              }}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--vscode-border)',
          background: 'var(--vscode-editor-background)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this PR..."
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--vscode-border)',
              background: 'var(--vscode-textCodeBlock-background)',
              color: 'var(--vscode-foreground)',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: '40px',
              maxHeight: '120px',
              lineHeight: '1.5',
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background:
                input.trim() && !isLoading
                  ? 'var(--vscode-textLink-foreground)'
                  : 'var(--vscode-button-secondaryBackground)',
              color:
                input.trim() && !isLoading
                  ? 'var(--vscode-button-foreground)'
                  : 'var(--vscode-button-secondaryForeground)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '6px', textAlign: 'center' }}>
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

function generateResponse(
  question: string,
  pr: PullRequest,
  files: PullRequestFile[],
  selectedFile: string | null,
  diffs: Map<string, PullRequestDiff>
): string {
  const lowerQuestion = question.toLowerCase();

  // What does this PR do?
  if (
    lowerQuestion.includes('what does') ||
    lowerQuestion.includes('what is') ||
    lowerQuestion.includes('what are')
  ) {
    return (
      `This PR (#${pr.number}) "${pr.title}" makes changes to ${files.length} file${files.length !== 1 ? 's' : ''}.\n\n` +
      `Summary:\n` +
      `• ${files.reduce((acc, f) => acc + f.additions, 0)} additions\n` +
      `• ${files.reduce((acc, f) => acc + f.deletions, 0)} deletions\n\n` +
      (pr.body
        ? `Description:\n${pr.body.substring(0, 500)}${pr.body.length > 500 ? '...' : ''}\n\n`
        : '') +
      `The main files changed are:\n${files
        .slice(0, 5)
        .map((f) => `• ${f.filename} (${f.status})`)
        .join('\n')}${files.length > 5 ? `\n... and ${files.length - 5} more` : ''}`
    );
  }

  // Main changes
  if (lowerQuestion.includes('main change') || lowerQuestion.includes('key change')) {
    const modifiedFiles = files.filter((f) => f.status === 'modified');
    const addedFiles = files.filter((f) => f.status === 'added');
    const removedFiles = files.filter((f) => f.status === 'removed');

    return (
      `Main changes in this PR:\n\n` +
      (modifiedFiles.length > 0
        ? `Modified files (${modifiedFiles.length}):\n${modifiedFiles
            .slice(0, 5)
            .map((f) => `• ${f.filename}: +${f.additions}/-${f.deletions}`)
            .join('\n')}\n\n`
        : '') +
      (addedFiles.length > 0
        ? `New files (${addedFiles.length}):\n${addedFiles.map((f) => `• ${f.filename}`).join('\n')}\n\n`
        : '') +
      (removedFiles.length > 0
        ? `Removed files (${removedFiles.length}):\n${removedFiles.map((f) => `• ${f.filename}`).join('\n')}\n\n`
        : '') +
      `Total impact: ${files.reduce((acc, f) => acc + f.additions, 0)} additions, ${files.reduce((acc, f) => acc + f.deletions, 0)} deletions`
    );
  }

  // Complex part
  if (
    lowerQuestion.includes('complex') ||
    lowerQuestion.includes('difficult') ||
    lowerQuestion.includes('hard')
  ) {
    const largestFile = files.reduce(
      (max, f) => (f.additions + f.deletions > max.additions + max.deletions ? f : max),
      files[0]
    );

    if (largestFile && diffs.has(largestFile.filename)) {
      const diff = diffs.get(largestFile.filename)!;
      return (
        `The most complex change appears to be in **${largestFile.filename}**:\n\n` +
        `• ${largestFile.additions + largestFile.deletions} total changes (${largestFile.additions} additions, ${largestFile.deletions} deletions)\n` +
        `• ${diff.hunks.length} code hunks modified\n\n` +
        `This file has the most significant changes. Would you like me to explain specific parts of this file?`
      );
    }
    return (
      `Looking at the changes, the files with the most modifications are:\n\n` +
      files
        .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
        .slice(0, 3)
        .map((f) => `• ${f.filename}: ${f.additions + f.deletions} changes`)
        .join('\n')
    );
  }

  // Potential issues
  if (
    lowerQuestion.includes('issue') ||
    lowerQuestion.includes('problem') ||
    lowerQuestion.includes('risk') ||
    lowerQuestion.includes('concern')
  ) {
    const largeFiles = files.filter((f) => f.additions + f.deletions > 100);
    const removedFiles = files.filter((f) => f.status === 'removed');

    let response = `Things to review carefully:\n\n`;

    if (largeFiles.length > 0) {
      response += `⚠️ Large changes (${largeFiles.length} file${largeFiles.length !== 1 ? 's' : ''}):\n`;
      response +=
        largeFiles.map((f) => `• ${f.filename}: ${f.additions + f.deletions} changes`).join('\n') +
        '\n\n';
    }

    if (removedFiles.length > 0) {
      response += `⚠️ Removed files (${removedFiles.length}):\n`;
      response += removedFiles.map((f) => `• ${f.filename}`).join('\n') + '\n\n';
    }

    response +=
      `💡 Review checklist:\n` +
      `• Check if large changes maintain code quality\n` +
      `• Verify removed code isn't needed elsewhere\n` +
      `• Ensure new code follows project conventions\n` +
      `• Test edge cases for modified logic`;

    return response;
  }

  // Default response
  return (
    `I can help you understand this PR! Here's what I know:\n\n` +
    `• ${files.length} file${files.length !== 1 ? 's' : ''} changed\n` +
    `• ${files.reduce((acc, f) => acc + f.additions, 0)} additions, ${files.reduce((acc, f) => acc + f.deletions, 0)} deletions\n\n` +
    `Try asking:\n` +
    `• "What does this PR do?"\n` +
    `• "Explain [filename]"\n` +
    `• "What are the main changes?"\n` +
    `• "Are there any potential issues?"`
  );
}
