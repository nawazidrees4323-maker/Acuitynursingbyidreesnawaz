import { Timestamp } from './lib/firebase';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  photoURL?: string;
  createdAt: Timestamp;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | string | number[]; // Can be index, text, or multiple indices
  type: 'mcq' | 'true-false' | 'short-answer' | 'essay' | 'multi-mcq';
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  explanation?: string;
  marks?: number;
}

export interface Quiz {
  id: string;
  title: string;
  courseId: string;
  subjectId: string;
  questions: Question[];
  timeLimit: number;
  attemptsLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  preventBacktracking: boolean;
  startTime?: Timestamp | null;
  endTime?: Timestamp | null;
  createdAt: Timestamp;
  createdBy: string;
}
