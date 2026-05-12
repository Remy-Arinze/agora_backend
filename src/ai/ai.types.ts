/** Shared AI / Lois types (used across AI services and external imports via ai.service re-export). */

export interface GenerateFlashcardsOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  count?: number;
  curriculum?: string;
}

export interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

export interface GenerateSummaryOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  weekContent?: string;
  curriculum?: string;
}

export interface GenerateQuizOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  questionCount?: number;
  questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer')[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface GenerateLessonPlanOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  objectives: string[];
  duration?: number;
  curriculum?: string;
}

export interface LessonPlan {
  title: string;
  objectives: string[];
  materials: string[];
  introduction: string;
  mainContent: { activity: string; duration: string; description: string }[];
  assessment: string;
  homework?: string;
  differentiation?: string;
}

export interface GradeEssayOptions {
  essay: string;
  prompt: string;
  rubric?: string;
  maxScore?: number;
  subject: string;
  gradeLevel: string;
}

export interface EssayGrade {
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  areasForImprovement: string[];
  suggestions: string[];
}

export interface GenerateQuestionsOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  questionCount?: number;
  questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer' | 'essay')[];
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  curriculum?: string;
}

export interface ParseCurriculumResult {
  topics: {
    topic: string;
    subTopics: string[];
    objectives: string[];
    resources: string[];
  }[];
}

export interface MultiGradeParseResult {
  results: {
    gradeLevel: string;
    topics: {
      topic: string;
      subTopics: string[];
      objectives: string[];
      resources: string[];
    }[];
  }[];
}

export interface VerificationResult {
  verified: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  subjectMatch: boolean;
  gradeLevelMatch: boolean;
}

export interface ConsolidateCurriculumResult {
  curriculumOverview: {
    description: string;
    themes: string[];
    progressionNotes: string;
  };
  terms: {
    term: number;
    termTitle: string;
    termSummary: string;
    topics: {
      title: string;
      description: string;
      subTopics: string[];
      learningOutcomes: string[];
      studentFriendlyOutcomes: string[];
      suggestedActivities: string[];
      resources: string[];
      assessmentType: string;
      order: number;
    }[];
  }[];
}

export interface SchemeOfWorkGenerationResult {
  weeks: {
    weekNumber: number;
    topic: string;
    subTopics: string[];
    learningOutcomes: string[];
    studentFriendlyOutcomes: string[];
    suggestedActivities: string[];
    resources: string[];
    assessmentType: string;
  }[];
}
