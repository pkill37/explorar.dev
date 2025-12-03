"use client";
import React, { useState, useEffect } from "react";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
  explanation?: string;
}

interface ChapterQuizProps {
  chapterId: string;
  questions: QuizQuestion[];
  onComplete?: (score: number, total: number) => void;
  isCompleted?: boolean;
}

export default function ChapterQuiz({ 
  questions, 
  onComplete,
  isCompleted = false 
}: ChapterQuizProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(isCompleted);

  useEffect(() => {
    setShowResults(isCompleted);
  }, [isCompleted]);

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmit = () => {
    if (Object.keys(selectedAnswers).length !== questions.length) {
      return; // Don't submit if not all questions answered
    }
    
    setSubmitted(true);
    setShowResults(true);
    
    // Calculate score
    const score = questions.reduce((acc, q) => {
      return acc + (selectedAnswers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);
    
    if (onComplete) {
      onComplete(score, questions.length);
    }
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setSubmitted(false);
    setShowResults(false);
  };

  const score = submitted ? questions.reduce((acc, q) => {
    return acc + (selectedAnswers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0) : 0;

  const allAnswered = Object.keys(selectedAnswers).length === questions.length;

  return (
    <div className="chapter-quiz">
      <div className="quiz-header">
        <span className="quiz-title">💡 Knowledge Check</span>
        {showResults && (
          <span className="quiz-score">
            {score}/{questions.length} correct
          </span>
        )}
      </div>

      <div className="quiz-questions">
        {questions.map((question, qIndex) => {
          const isCorrect = selectedAnswers[question.id] === question.correctAnswer;
          
          return (
            <div key={question.id} className="quiz-question">
              <div className="question-text">
                {qIndex + 1}. {question.question}
              </div>
              
              <div className="question-options">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selectedAnswers[question.id] === optionIndex;
                  const isCorrectOption = optionIndex === question.correctAnswer;
                  
                  let optionClass = "quiz-option";
                  if (isSelected) optionClass += " selected";
                  if (showResults && isCorrectOption) optionClass += " correct";
                  if (showResults && isSelected && !isCorrect) optionClass += " incorrect";
                  
                  return (
                    <div
                      key={optionIndex}
                      className={optionClass}
                      onClick={() => handleAnswerSelect(question.id, optionIndex)}
                    >
                      <span className="option-label">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      <span className="option-text">{option}</span>
                      {showResults && isCorrectOption && (
                        <span className="option-indicator">✓</span>
                      )}
                      {showResults && isSelected && !isCorrect && (
                        <span className="option-indicator">✗</span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {showResults && question.explanation && (
                <div className="question-explanation">
                  <strong>Explanation:</strong> {question.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="quiz-actions">
        {!submitted ? (
          <button
            className="quiz-button"
            onClick={handleSubmit}
            disabled={!allAnswered}
          >
            Submit Answers
          </button>
        ) : (
          <button
            className="quiz-button quiz-button-retry"
            onClick={handleRetry}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

