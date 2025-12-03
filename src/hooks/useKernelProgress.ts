"use client";
import { useState, useEffect, useCallback } from "react";

export interface ChapterProgress {
  chapterId: string;
  quizCompleted: boolean;
  quizScore: number;
  quizTotal: number;
  lastAttemptDate?: string;
}

export interface KernelProgress {
  chapters: Record<string, ChapterProgress>;
  overallProgress: number;
}

const STORAGE_KEY = "kernel-study-progress";

const defaultChapterProgress = (chapterId: string): ChapterProgress => ({
  chapterId,
  quizCompleted: false,
  quizScore: 0,
  quizTotal: 0,
});

export function useKernelProgress(chapterIds: string[]) {
  const [progress, setProgress] = useState<KernelProgress>(() => {
    // Initialize with default values (will be overwritten by localStorage if available)
    return {
      chapters: Object.fromEntries(
        chapterIds.map(id => [id, defaultChapterProgress(id)])
      ),
      overallProgress: 0,
    };
  });

  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as KernelProgress;
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setProgress(parsed);
        }, 0);
      }
    } catch (error) {
      console.error("Failed to load kernel progress:", error);
    }
    
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setIsHydrated(true);
    }, 0);
  }, []);

  // Save to localStorage whenever progress changes
  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error("Failed to save kernel progress:", error);
    }
  }, [progress, isHydrated]);

  const calculateOverallProgress = useCallback((chapters: Record<string, ChapterProgress>) => {
    const totalChapters = Object.keys(chapters).length;
    if (totalChapters === 0) return 0;

    const completedChapters = Object.values(chapters).filter(
      ch => ch.quizCompleted
    ).length;

    return Math.round((completedChapters / totalChapters) * 100);
  }, []);

  const markQuizComplete = useCallback((
    chapterId: string,
    score: number,
    total: number
  ) => {
    setProgress(prev => {
      const updatedChapters = {
        ...prev.chapters,
        [chapterId]: {
          chapterId,
          quizCompleted: true,
          quizScore: score,
          quizTotal: total,
          lastAttemptDate: new Date().toISOString(),
        },
      };

      return {
        chapters: updatedChapters,
        overallProgress: calculateOverallProgress(updatedChapters),
      };
    });
  }, [calculateOverallProgress]);

  const resetProgress = useCallback(() => {
    const resetChapters = Object.fromEntries(
      chapterIds.map(id => [id, defaultChapterProgress(id)])
    );
    
    setProgress({
      chapters: resetChapters,
      overallProgress: 0,
    });

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Failed to reset kernel progress:", error);
      }
    }
  }, [chapterIds]);

  const getChapterProgress = useCallback((chapterId: string): ChapterProgress => {
    return progress.chapters[chapterId] || defaultChapterProgress(chapterId);
  }, [progress.chapters]);

  return {
    progress,
    markQuizComplete,
    resetProgress,
    getChapterProgress,
    isHydrated,
  };
}







