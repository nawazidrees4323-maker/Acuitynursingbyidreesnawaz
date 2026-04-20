import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, Timestamp, query, where, addDoc, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  BrainCircuit, 
  Plus, 
  Trash2, 
  Pencil,
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Play, 
  Save, 
  ListChecks, 
  TrendingUp,
  Users,
  Calendar,
  FileText,
  Info,
  BarChart3,
  PieChart as PieChartIcon,
  LayoutDashboard,
  Search,
  AlertCircle,
  Trophy,
  BookOpen,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Quiz, Question } from '../types';
import { format } from 'date-fns';

interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  answers: any[];
  startTime: Timestamp;
  lastUpdated: Timestamp;
  status: 'in-progress' | 'completed';
  timeSpent: number;
  cheatingWarnings: number;
  deviceInfo: string;
  ipAddress: string;
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  seqMarks?: number[];
  markingStatus?: 'pending' | 'marked';
}

export default function Quizzes({ profile }: { profile: UserProfile }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [allAttempts, setAllAttempts] = useState<any[]>([]);
  const [selectedAnalyticsQuizId, setSelectedAnalyticsQuizId] = useState<string | 'all'>('all');
  const [selectedLeaderboardQuizId, setSelectedLeaderboardQuizId] = useState<string | 'all'>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [markingResult, setMarkingResult] = useState<any>(null);
  const [seqMarks, setSeqMarks] = useState<number[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';

  // New Quiz Form State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    courseId: '',
    subjectId: '',
    timeLimit: 30,
    attemptsLimit: 1,
    startTime: '',
    endTime: '',
    shuffleQuestions: false,
    shuffleOptions: false,
    preventBacktracking: false,
    questions: [{ 
      id: Math.random().toString(36).substr(2, 9),
      question: '', 
      options: ['', '', '', ''], 
      correctAnswer: -1, 
      type: 'mcq' as any,
      difficulty: 'medium' as any,
      topic: '',
      explanation: ''
    }]
  });

  const parseBulkQuestions = () => {
    const questions: Question[] = [];
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l !== '');
    
    let currentQuestion: Partial<Question> | null = null;

    lines.forEach((line) => {
      // 1. Detect Question Start (e.g., "1.", "1)", "Q1:", "[1]")
      const questionMatch = line.match(/^(\d+|Q\d+|Question\s*\d+)[.\)\-:\s\]]+\s*(.*)/i);
      
      // 2. Detect Options (e.g., "A.", "a)", "(B)", "C:")
      const optionMatch = line.match(/^[\(\[]?([A-D]|[a-d])[\)\]\.\-:\s]+\s*(.*)/i);
      
      // 3. Detect Answer Key (e.g., "Answer: A", "Ans: B", "Key: C")
      const answerMatch = line.match(/^(?:Answer|Correct|Ans|Key|Result|Correct Answer)[:\-\s]+\s*([A-D]|[a-d])/i);

      // 4. Heuristic for new question without a number
      // If we have a question that already has an answer or 4 options, 
      // and the current line doesn't look like an option or answer, it's a new question.
      const isNewQuestionHeuristic = currentQuestion && 
                                     (currentQuestion.correctAnswer !== -1 || currentQuestion.options!.length >= 4) && 
                                     !optionMatch && 
                                     !answerMatch;

      if (questionMatch || isNewQuestionHeuristic) {
        // Save previous question
        if (currentQuestion && currentQuestion.question) {
          while (currentQuestion.options!.length < 4) currentQuestion.options!.push('');
          questions.push(currentQuestion as Question);
        }
        
        // Start new question
        currentQuestion = {
          id: Math.random().toString(36).substr(2, 9),
          question: questionMatch ? questionMatch[2] : line,
          options: [],
          correctAnswer: -1,
          type: 'mcq',
          difficulty: 'medium',
          topic: ''
        };
      } else if (optionMatch && currentQuestion) {
        // Add option
        if (currentQuestion.options!.length < 4) {
          currentQuestion.options!.push(optionMatch[2]);
        }
      } else if (answerMatch && currentQuestion) {
        // Set correct answer
        const letter = answerMatch[1].toUpperCase();
        currentQuestion.correctAnswer = letter.charCodeAt(0) - 65;
      } else if (currentQuestion) {
        // Append to existing part
        if (currentQuestion.options!.length === 0) {
          currentQuestion.question += ' ' + line;
        } else {
          const lastIdx = currentQuestion.options!.length - 1;
          currentQuestion.options![lastIdx] += ' ' + line;
        }
      } else {
        // First line fallback
        currentQuestion = {
          id: Math.random().toString(36).substr(2, 9),
          question: line,
          options: [],
          correctAnswer: -1,
          type: 'mcq',
          difficulty: 'medium',
          topic: ''
        };
      }
    });

    // Save the very last question
    if (currentQuestion && currentQuestion.question) {
      while (currentQuestion.options!.length < 4) currentQuestion.options!.push('');
      questions.push(currentQuestion as Question);
    }

    if (questions.length > 0) {
      // Check if we should append or replace
      // If there's only one question and it's empty, replace it. Otherwise append.
      const currentQuestions = newQuiz.questions || [];
      const isFirstEmpty = currentQuestions.length === 1 && currentQuestions[0].question.trim() === '';
      
      setNewQuiz({ 
        ...newQuiz, 
        questions: isFirstEmpty ? questions : [...currentQuestions, ...questions] 
      });
      setIsBulkMode(false);
      setBulkText('');
    } else {
      alert('Could not parse any questions. Please check the format.');
    }
  };

  useEffect(() => {
    fetchQuizzes();
    fetchCourses();
    fetchSubjects();
    
    let unsubscribeResults: (() => void) | undefined;
    let unsubscribeAttempts: (() => void) | undefined;
    
    if (profile.status === 'approved') {
      // Use onSnapshot for real-time analytics and leaderboard updates
      const resultsQuery = query(collection(db, 'quiz_results'));
      unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by date descending
        results.sort((a: any, b: any) => {
          const dateA = a.completedAt?.toDate() || 0;
          const dateB = b.completedAt?.toDate() || 0;
          return dateB - dateA;
        });
        setAllResults(results);
      }, (error) => {
        console.error('Error fetching results:', error);
      });

      // Fetch attempts to track dropouts
      const attemptsQuery = query(collection(db, 'quiz_attempts'));
      unsubscribeAttempts = onSnapshot(attemptsQuery, (snapshot) => {
        const attempts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllAttempts(attempts);
      }, (error) => {
        console.error('Error fetching attempts:', error);
      });
    }

    return () => {
      if (unsubscribeResults) unsubscribeResults();
      if (unsubscribeAttempts) unsubscribeAttempts();
    };
  }, [profile.role]);

  // Update current time every second for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'quizzes'));
      const quizzesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      quizzesData.sort((a, b) => {
        const dateA = a.startTime?.toDate().getTime() || 0;
        const dateB = b.startTime?.toDate().getTime() || 0;
        return dateB - dateA;
      });
      setQuizzes(quizzesData);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    const querySnapshot = await getDocs(collection(db, 'courses'));
    setCourses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchSubjects = async () => {
    const querySnapshot = await getDocs(collection(db, 'subjects'));
    setSubjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const downloadQuizPDF = (quiz: Quiz) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper for watermark
    const addWatermark = (pdfDoc: jsPDF) => {
      pdfDoc.saveGraphicsState();
      pdfDoc.setGState(pdfDoc.GState({ opacity: 0.12 }));
      pdfDoc.setFontSize(40);
      pdfDoc.setTextColor(120);
      pdfDoc.setFont('helvetica', 'bold');
      
      const text = "Acuity Nursing Forum";
      
      // 3-Row Diagonal Pattern for full page coverage
      pdfDoc.text(text, pageWidth / 2, pageHeight * 0.25, { angle: 45, align: 'center' });
      pdfDoc.text(text, pageWidth / 2, pageHeight * 0.5, { angle: 45, align: 'center' });
      pdfDoc.text(text, pageWidth / 2, pageHeight * 0.75, { angle: 45, align: 'center' });
      
      pdfDoc.restoreGraphicsState();
    };

    // Header
    addWatermark(doc);
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.setFont('helvetica', 'bold');
    doc.text("Acuity Nursing Forum", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55); // Gray-800
    doc.text(quiz.title, pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text(`Time Limit: ${quiz.timeLimit} Minutes | Total Questions: ${quiz.questions.length}`, pageWidth / 2, 38, { align: 'center' });
    
    doc.setDrawColor(229, 231, 235); // Gray-200
    doc.line(20, 45, pageWidth - 20, 45);

    let yPos = 55;

    quiz.questions.forEach((q, idx) => {
      // Check for page break
      if (yPos > pageHeight - 40) {
        doc.addPage();
        addWatermark(doc);
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39); // Gray-900
      doc.setFont('helvetica', 'bold');
      const questionLines = doc.splitTextToSize(`${idx + 1}. ${q.question}`, pageWidth - 40);
      doc.text(questionLines, 20, yPos);
      yPos += (questionLines.length * 6) + 4;

      if (q.type === 'mcq' || q.type === 'multi-mcq' || q.type === 'true-false') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99); // Gray-600
        
        q.options.forEach((opt, oIdx) => {
          const label = q.type === 'true-false' ? (oIdx === 0 ? 'True' : 'False') : String.fromCharCode(65 + oIdx);
          const optionText = `${label}) ${opt}`;
          const optionLines = doc.splitTextToSize(optionText, pageWidth - 50);
          
          // Check for page break within options
          if (yPos > pageHeight - 20) {
            doc.addPage();
            addWatermark(doc);
            yPos = 20;
          }
          
          doc.text(optionLines, 25, yPos);
          yPos += (optionLines.length * 5) + 2;
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175); // Gray-400
        doc.text("[Answer here...]", 25, yPos);
        yPos += 15;
      }

      yPos += 5; // Extra spacing between questions
    });

    // Footer on last page
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated on ${format(new Date(), 'PPpp')}`, 20, pageHeight - 10);
    doc.text("Acuity Nursing Academy - Learning Management System", pageWidth - 20, pageHeight - 10, { align: 'right' });

    doc.save(`${quiz.title.replace(/\s+/g, '_')}_Quiz.pdf`);
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const invalidMcq = newQuiz.questions.find(q => (q.type === 'mcq' || q.type === 'true-false') && q.correctAnswer === -1);
    if (invalidMcq) {
      alert(`Please select a correct answer for question: "${invalidMcq.question.substring(0, 30)}..."`);
      return;
    }

    const emptyQuestion = newQuiz.questions.find(q => q.question.trim() === '');
    if (emptyQuestion) {
      alert('One or more questions are empty. Please fill them or remove them.');
      return;
    }

    try {
      const quizData = {
        ...newQuiz,
        startTime: newQuiz.startTime ? Timestamp.fromDate(new Date(newQuiz.startTime)) : null,
        endTime: newQuiz.endTime ? Timestamp.fromDate(new Date(newQuiz.endTime)) : null,
        updatedAt: Timestamp.now(),
        createdBy: editingQuiz ? editingQuiz.createdBy : profile.uid,
        ...(editingQuiz ? {} : { createdAt: Timestamp.now() })
      };

      if (editingQuiz) {
        await setDoc(doc(db, 'quizzes', editingQuiz.id), quizData);
      } else {
        await addDoc(collection(db, 'quizzes'), quizData);
        
        // Also add questions to Question Bank (only for new quizzes to avoid duplicates)
        for (const q of newQuiz.questions) {
          await addDoc(collection(db, 'question_bank'), {
            ...q,
            courseId: newQuiz.courseId,
            subjectId: newQuiz.subjectId,
            createdAt: Timestamp.now(),
            createdBy: profile.uid
          });
        }
      }

      setIsModalOpen(false);
      setEditingQuiz(null);
      setNewQuiz({
        title: '',
        courseId: '',
        subjectId: '',
        timeLimit: 30,
        attemptsLimit: 1,
        startTime: '',
        endTime: '',
        shuffleQuestions: false,
        shuffleOptions: false,
        preventBacktracking: false,
        questions: [{ 
          id: Math.random().toString(36).substr(2, 9),
          question: '', 
          options: ['', '', '', ''], 
          correctAnswer: -1, 
          type: 'mcq',
          difficulty: 'medium',
          topic: '',
          explanation: ''
        }]
      });
      fetchQuizzes();
    } catch (error) {
      console.error('Error saving quiz:', error);
      alert('Failed to save quiz. Please check your connection and try again.');
    }
  };

  const formatDateForInput = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setNewQuiz({
      title: quiz.title,
      courseId: quiz.courseId,
      subjectId: quiz.subjectId,
      timeLimit: quiz.timeLimit,
      attemptsLimit: quiz.attemptsLimit,
      startTime: formatDateForInput(quiz.startTime || null),
      endTime: formatDateForInput(quiz.endTime || null),
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      preventBacktracking: quiz.preventBacktracking,
      questions: quiz.questions
    });
    setIsModalOpen(true);
  };

  const handleDeleteQuiz = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      try {
        await deleteDoc(doc(db, 'quizzes', id));
        fetchQuizzes();
      } catch (error) {
        console.error('Error deleting quiz:', error);
      }
    }
  };

  const addQuestion = (type: any = 'mcq') => {
    setNewQuiz({
      ...newQuiz,
      questions: [...newQuiz.questions, { 
        id: Math.random().toString(36).substr(2, 9),
        question: '', 
        options: (type === 'mcq' || type === 'multi-mcq') ? ['', '', '', ''] : (type === 'true-false' ? ['True', 'False'] : []), 
        correctAnswer: type === 'multi-mcq' ? [] : -1, 
        type,
        difficulty: 'medium',
        topic: '',
        explanation: ''
      }]
    });
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updatedQuestions = [...newQuiz.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setNewQuiz({ ...newQuiz, questions: updatedQuestions });
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updatedQuestions = [...newQuiz.questions];
    updatedQuestions[qIndex].options[oIndex] = value;
    setNewQuiz({ ...newQuiz, questions: updatedQuestions });
  };

  // Quiz Player State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [cheatingWarnings, setCheatingWarnings] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const startQuiz = async (quiz: Quiz) => {
    if (!quiz || !quiz.id) {
      alert('Invalid quiz data.');
      return;
    }

    // Check if quiz is open
    const now = new Date();
    if (quiz.startTime && now < quiz.startTime.toDate()) {
      alert(`This quiz will open on ${format(quiz.startTime.toDate(), 'PPpp')}`);
      return;
    }
    if (quiz.endTime && now > quiz.endTime.toDate()) {
      alert(`This quiz closed on ${format(quiz.endTime.toDate(), 'PPpp')}`);
      return;
    }

    if (!profile || !profile.uid) {
      alert('User profile not found. Please log in again.');
      return;
    }

    if (!quiz.questions || !Array.isArray(quiz.questions)) {
      alert('This quiz has no questions or invalid question data.');
      return;
    }

    try {
      console.log('Starting quiz:', quiz.id, 'for user:', profile.uid);
      
      // Check for existing attempt
      const q = query(
        collection(db, 'quiz_attempts'),
        where('quizId', '==', quiz.id),
        where('studentId', '==', profile.uid),
        where('status', '==', 'in-progress')
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err: any) {
        console.error('Error fetching existing attempt:', err);
        if (err.message.includes('index')) {
          alert('Database index is being created. Please wait a few minutes and try again.');
          return;
        }
        throw new Error(`Failed to check existing attempts: ${err.message}`);
      }
      
      let currentAttempt;
      if (!snapshot.empty) {
        currentAttempt = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
        
        // Parse answers if they are stored as a string
        let parsedAnswers = [];
        try {
          parsedAnswers = typeof currentAttempt.answers === 'string' 
            ? JSON.parse(currentAttempt.answers) 
            : (currentAttempt.answers || []);
        } catch (e) {
          console.error('Error parsing answers:', e);
          parsedAnswers = [];
        }
        
        setAnswers(parsedAnswers);
        setCheatingWarnings(currentAttempt.cheatingWarnings || 0);
        setAttemptId(currentAttempt.id);
        
        const startTime = currentAttempt.startTime?.toMillis() || Timestamp.now().toMillis();
        const elapsed = Math.floor((Timestamp.now().toMillis() - startTime) / 1000);
        const remaining = (quiz.timeLimit * 60) - elapsed;
        setTimeLeft(remaining > 0 ? remaining : 0);
      } else {
        // Check attempts limit
        const completedQ = query(
          collection(db, 'quiz_attempts'),
          where('quizId', '==', quiz.id),
          where('studentId', '==', profile.uid),
          where('status', '==', 'completed')
        );
        
        let completedSnapshot;
        try {
          completedSnapshot = await getDocs(completedQ);
        } catch (err: any) {
          console.error('Error fetching completed attempts:', err);
          throw new Error(`Failed to check attempts limit: ${err.message}`);
        }

        if (completedSnapshot.size >= quiz.attemptsLimit) {
          alert(`You have reached the maximum number of attempts (${quiz.attemptsLimit}) for this quiz.`);
          return;
        }

        const initialAnswers = quiz.questions.map(q => {
          if (q.type === 'multi-mcq') return [];
          if (q.type === 'true-false') return -1;
          if (q.type === 'mcq') return -1;
          return '';
        });

        const newAttempt = {
          quizId: quiz.id,
          quizTitle: quiz.title,
          studentId: profile.uid,
          studentName: profile.name,
          // Stringify answers to avoid "Nested arrays are not supported" error
          answers: JSON.stringify(initialAnswers),
          startTime: Timestamp.now(),
          lastUpdated: Timestamp.now(),
          status: 'in-progress',
          timeSpent: 0,
          cheatingWarnings: 0,
          deviceInfo: navigator.userAgent,
          ipAddress: 'Unknown'
        };
        
        try {
          const docRef = await addDoc(collection(db, 'quiz_attempts'), newAttempt);
          setAttemptId(docRef.id);
          setAnswers(initialAnswers);
          setCheatingWarnings(0);
          setTimeLeft(quiz.timeLimit * 60);
        } catch (err: any) {
          console.error('Error creating new attempt:', err);
          throw new Error(`Failed to create new attempt: ${err.message}`);
        }
      }

      setActiveQuiz(quiz);
      setCurrentQuestionIndex(0);
      setQuizResults(null);

      // Enforce Fullscreen
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }
    } catch (error: any) {
      console.error('Error starting quiz:', error);
      if (error.message.includes('Missing or insufficient permissions')) {
        alert('Permission denied. Please ensure you are logged in and approved.');
        try {
          handleFirestoreError(error, OperationType.WRITE, 'quiz_attempts');
        } catch (e) {}
      } else {
        alert(`Failed to start quiz: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Auto-save answers
  useEffect(() => {
    if (activeQuiz && attemptId && !quizResults) {
      const saveAnswers = async () => {
        try {
          await setDoc(doc(db, 'quiz_attempts', attemptId), {
            answers: JSON.stringify(answers),
            lastUpdated: Timestamp.now(),
            cheatingWarnings
          }, { merge: true });
        } catch (error) {
          console.error('Error auto-saving answers:', error);
        }
      };
      const timer = setTimeout(saveAnswers, 2000);
      return () => clearTimeout(timer);
    }
  }, [answers, cheatingWarnings, attemptId, activeQuiz, quizResults]);

  // Anti-cheating: Tab switching detection
  useEffect(() => {
    if (activeQuiz && !quizResults) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setCheatingWarnings(prev => {
            const newVal = prev + 1;
            if (newVal >= 3) {
              alert('Multiple tab switches detected. Auto-submitting quiz.');
              submitQuiz();
            } else {
              alert(`Warning: Tab switching is not allowed! (${newVal}/3)`);
            }
            return newVal;
          });
        }
      };

      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) {
          e.preventDefault();
          alert('Copy/Paste is disabled during the quiz.');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [activeQuiz, quizResults]);

  useEffect(() => {
    if (activeQuiz && timeLeft > 0 && !quizResults) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && activeQuiz && !quizResults) {
      submitQuiz();
    }
  }, [activeQuiz, timeLeft, quizResults]);

  const submitQuiz = async () => {
    if (!activeQuiz || !attemptId) return;
    
    // Exit Fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    let score = 0;
    let autoGradableCount = 0;
    let hasManualMarking = false;

    activeQuiz.questions.forEach((q, i) => {
      const userAnswer = answers[i];
      if (q.type === 'mcq' || q.type === 'true-false') {
        autoGradableCount++;
        if (userAnswer === q.correctAnswer) score++;
      } else if (q.type === 'multi-mcq') {
        autoGradableCount++;
        const correctOptions = q.correctAnswer as number[];
        const userOptions = userAnswer as number[];
        if (correctOptions.length === userOptions.length && correctOptions.every(val => userOptions.includes(val))) {
          score++;
        }
      } else if (q.type === 'short-answer') {
        autoGradableCount++;
        const normalizedUser = (userAnswer as string).toLowerCase().trim();
        const matches = q.keywords?.some(k => normalizedUser.includes(k.toLowerCase())) || normalizedUser === (q.correctAnswer as string).toLowerCase().trim();
        if (matches) score++;
      } else if (q.type === 'long-answer') {
        hasManualMarking = true;
      }
    });
    
    const resultData = {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      studentId: profile.uid,
      studentName: profile.name,
      score,
      totalQuestions: activeQuiz.questions.length,
      percentage: autoGradableCount > 0 ? (score / autoGradableCount) * 100 : 0,
      completedAt: Timestamp.now(),
      userAnswers: answers,
      questions: activeQuiz.questions,
      status: hasManualMarking ? 'pending_marking' : 'marked',
      cheatingWarnings,
      timeSpent: (activeQuiz.timeLimit * 60) - timeLeft
    };

    try {
      await setDoc(doc(db, 'quiz_attempts', attemptId), {
        ...resultData,
        answers: JSON.stringify(answers),
        userAnswers: JSON.stringify(answers),
        status: 'completed'
      }, { merge: true });
      
      // Also save to quiz_results for backward compatibility and analytics
      await addDoc(collection(db, 'quiz_results'), {
        ...resultData,
        userAnswers: JSON.stringify(answers)
      });
      
      setQuizResults(resultData);
    } catch (error) {
      console.error('Error saving result:', error);
      setQuizResults(resultData);
    }
  };

  const handleMarkingSubmit = async () => {
    if (!markingResult) return;
    
    const totalSeqMarks = seqMarks.reduce((acc, curr) => acc + curr, 0);
    const finalScore = markingResult.score + totalSeqMarks;
    const finalPercentage = (finalScore / markingResult.totalQuestions) * 100;

    try {
      await setDoc(doc(db, 'quiz_results', markingResult.id), {
        score: finalScore,
        percentage: finalPercentage,
        seqMarks,
        status: 'marked'
      }, { merge: true });

      // Send notification to student
      const notifId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: markingResult.studentId,
        title: 'Quiz Marked',
        message: `Your quiz "${markingResult.quizTitle}" has been marked. Final score: ${finalScore}/${markingResult.totalQuestions}`,
        createdAt: Timestamp.now(),
        read: false
      });

      setMarkingResult(null);
      alert('Quiz marked successfully!');
    } catch (error) {
      console.error('Error updating marks:', error);
      alert('Failed to update marks.');
    }
  };
  const getTopScorers = (quizId: string | 'all' = 'all') => {
    const studentScores: { [key: string]: { name: string, totalScore: number, quizzesTaken: number } } = {};
    
    const filteredResults = quizId === 'all' 
      ? allResults 
      : allResults.filter(res => res.quizId === quizId);

    filteredResults.forEach(res => {
      if (!studentScores[res.studentId]) {
        studentScores[res.studentId] = { name: res.studentName, totalScore: 0, quizzesTaken: 0 };
      }
      studentScores[res.studentId].totalScore += res.percentage;
      studentScores[res.studentId].quizzesTaken += 1;
    });

    return Object.entries(studentScores)
      .map(([id, data]) => ({
        id,
        name: data.name,
        average: Math.round(data.totalScore / data.quizzesTaken),
        quizzes: data.quizzesTaken
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 10);
  };

  const getAnalyticsData = () => {
    const filteredResults = selectedAnalyticsQuizId === 'all' 
      ? allResults 
      : allResults.filter(r => r.quizId === selectedAnalyticsQuizId);

    const filteredAttempts = selectedAnalyticsQuizId === 'all'
      ? allAttempts
      : allAttempts.filter(a => a.quizId === selectedAnalyticsQuizId);

    const dropouts = filteredAttempts.filter(a => a.status === 'in-progress');
    
    const stats = {
      total: filteredResults.length + dropouts.length,
      completed: filteredResults.length,
      dropped: dropouts.length,
      avgScore: filteredResults.length > 0 
        ? Math.round(filteredResults.reduce((acc, r) => acc + r.percentage, 0) / filteredResults.length)
        : 0,
      highestScore: filteredResults.length > 0
        ? Math.max(...filteredResults.map(r => r.percentage))
        : 0
    };

    const toppers = [...new Set(filteredResults
      .filter(r => r.percentage === stats.highestScore && stats.highestScore > 0)
      .map(r => r.studentName))];

    return { filteredResults, dropouts, stats, toppers };
  };

  const analyticsData = getAnalyticsData();
  const topScorers = getTopScorers(selectedLeaderboardQuizId);

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Quizzes & Exams</h1>
          <p className="text-gray-500 font-medium">Test your knowledge and track progress</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              const nextState = !showLeaderboard;
              setShowLeaderboard(nextState);
              setShowAnalytics(false);
              if (nextState && selectedLeaderboardQuizId === 'all' && quizzes.length > 0) {
                // Default to latest quiz
                setSelectedLeaderboardQuizId(quizzes[0].id);
              }
            }}
            className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
              showLeaderboard ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Leaderboard
          </button>
          <button 
            onClick={() => {
              const nextState = !showAnalytics;
              setShowAnalytics(nextState);
              setShowLeaderboard(false);
              if (nextState && selectedAnalyticsQuizId === 'all' && quizzes.length > 0) {
                // Default to latest quiz
                setSelectedAnalyticsQuizId(quizzes[0].id);
              }
            }}
            className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
              showAnalytics ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            {profile.role === 'student' ? 'My Progress' : 'Analytics'}
          </button>
          {(profile.role === 'admin' || profile.role === 'teacher') && (
            <button 
              onClick={() => {
                setEditingQuiz(null);
                setNewQuiz({
                  title: '',
                  courseId: '',
                  subjectId: '',
                  timeLimit: 30,
                  attemptsLimit: 1,
                  startTime: '',
                  endTime: '',
                  shuffleQuestions: false,
                  shuffleOptions: false,
                  preventBacktracking: false,
                  questions: [{ 
                    id: Math.random().toString(36).substr(2, 9),
                    question: '', 
                    options: ['', '', '', ''], 
                    correctAnswer: -1, 
                    type: 'mcq',
                    difficulty: 'medium',
                    topic: '',
                    explanation: ''
                  }]
                });
                setIsModalOpen(true);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Quiz
            </button>
          )}
        </div>
      </div>

      {showAnalytics ? (
        <div className="space-y-8">
          {profile.role === 'student' ? (
            <>
              {(() => {
                const userResults = allResults.filter(r => r.studentId === profile.uid);
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-2xl font-black text-gray-900">{userResults.length}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quizzes Taken</p>
                      </div>
                      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <p className="text-2xl font-black text-gray-900">
                          {userResults.length > 0 
                            ? Math.round(userResults.reduce((acc, curr) => acc + curr.percentage, 0) / userResults.length) 
                            : 0}%
                        </p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Average Score</p>
                      </div>
                      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-2xl font-black text-gray-900">
                          {userResults.filter(r => r.percentage >= 50).length}
                        </p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quizzes Passed</p>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                      <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Performance Trend
                      </h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={userResults.slice().reverse().map((r, i) => ({
                            name: `Quiz ${i + 1}`,
                            score: r.percentage
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{allResults.length}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Attempts</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {allResults.length > 0 
                      ? Math.round(allResults.reduce((acc, curr) => acc + curr.percentage, 0) / allResults.length) 
                      : 0}%
                  </p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Average Score</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {allResults.filter(r => r.status === 'pending_marking').length}
                  </p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending Marking</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{quizzes.length}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Quizzes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Score Distribution
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { range: '0-20', count: allResults.filter(r => r.percentage < 20).length },
                        { range: '20-40', count: allResults.filter(r => r.percentage >= 20 && r.percentage < 40).length },
                        { range: '40-60', count: allResults.filter(r => r.percentage >= 40 && r.percentage < 60).length },
                        { range: '60-80', count: allResults.filter(r => r.percentage >= 60 && r.percentage < 80).length },
                        { range: '80-100', count: allResults.filter(r => r.percentage >= 80).length },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#f9fafb' }}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-purple-600" />
                    Pass vs Fail Rate
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Pass', value: allResults.filter(r => r.percentage >= 50).length },
                            { name: 'Fail', value: allResults.filter(r => r.percentage < 50).length },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-8 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-xs font-bold text-gray-600">Pass (≥50%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-xs font-bold text-gray-600">Fail (&lt;50%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : showLeaderboard ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">
                {selectedLeaderboardQuizId === 'all' ? 'Overall Top Performers' : `Top Performers: ${quizzes.find(q => q.id === selectedLeaderboardQuizId)?.title}`}
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                {selectedLeaderboardQuizId === 'all' ? 'The brightest minds across all quizzes' : 'Top scorers for this specific test'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Filter by Quiz:</span>
              <select 
                value={selectedLeaderboardQuizId}
                onChange={(e) => setSelectedLeaderboardQuizId(e.target.value)}
                className="px-6 py-3 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-indigo-100 min-w-[250px]"
              >
                <option value="all">All Quizzes (Overall)</option>
                {quizzes.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topScorers.slice(0, 3).map((scorer, idx) => (
              <motion.div 
                key={scorer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-8 rounded-[2.5rem] border-2 text-center relative overflow-hidden ${
                  idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 border-amber-300 text-white' :
                  idx === 1 ? 'bg-white border-gray-100 text-gray-900' :
                  'bg-white border-gray-100 text-gray-900'
                }`}
              >
                {idx === 0 && <div className="absolute top-4 right-4 text-4xl opacity-20">🏆</div>}
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg ${
                  idx === 0 ? 'bg-white text-amber-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {idx + 1}
                </div>
                <h3 className="text-xl font-black mb-1">{scorer.name}</h3>
                <p className={`text-sm font-bold uppercase tracking-widest ${idx === 0 ? 'text-amber-100' : 'text-gray-400'}`}>
                  {selectedLeaderboardQuizId === 'all' ? `${scorer.average}% Average` : `${scorer.average}% Score`}
                </p>
                <div className={`mt-4 inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  idx === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedLeaderboardQuizId === 'all' ? `${scorer.quizzes} Quizzes Taken` : 'Single Attempt'}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">
                {selectedLeaderboardQuizId === 'all' ? 'Top Performers' : 'Quiz Ranking'}
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                {selectedLeaderboardQuizId === 'all' ? 'The brightest minds of the academy' : 'Ranked list of students for this test'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rank</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                      {selectedLeaderboardQuizId === 'all' ? 'Avg. Score' : 'Score'}
                    </th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      {selectedLeaderboardQuizId === 'all' ? 'Quizzes' : 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topScorers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-gray-400 font-medium">No one has attempted this quiz yet.</td>
                    </tr>
                  ) : (
                    topScorers.map((scorer, idx) => (
                      <tr key={scorer.id} className="hover:bg-gray-50 transition-all">
                        <td className="px-8 py-5">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                            idx === 0 ? 'bg-amber-100 text-amber-600' :
                            idx === 1 ? 'bg-gray-100 text-gray-600' :
                            idx === 2 ? 'bg-orange-50 text-orange-600' :
                            'text-gray-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-bold text-gray-900">{scorer.name}</p>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-lg font-black text-blue-600">{scorer.average}%</span>
                        </td>
                        <td className="px-8 py-5 text-right font-bold text-gray-500">
                          {selectedLeaderboardQuizId === 'all' ? (
                            scorer.quizzes
                          ) : (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : showAnalytics ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">Quiz Analytics</h2>
              <p className="text-sm text-gray-500 font-medium">Detailed performance breakdown by quiz</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Quiz:</span>
              <select 
                value={selectedAnalyticsQuizId}
                onChange={(e) => setSelectedAnalyticsQuizId(e.target.value)}
                className="px-6 py-3 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-100 min-w-[250px]"
              >
                <option value="all">All Quizzes</option>
                {quizzes.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-gray-900">{analyticsData.stats.total}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Attempts</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-4">
                <ListChecks className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-gray-900">{analyticsData.stats.completed}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completed</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-gray-900">{analyticsData.stats.dropped}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dropped/In-Progress</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-gray-900">{analyticsData.stats.avgScore}%</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Average Score</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-gray-900">{analyticsData.stats.highestScore}%</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Highest Score</p>
            </div>
          </div>

          {analyticsData.toppers.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-8 rounded-[2.5rem] border border-amber-100 flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm">🏆</div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Quiz Topper(s)</p>
                <h3 className="text-xl font-black text-amber-900">
                  {analyticsData.toppers.join(', ')}
                </h3>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900">Attempt Records</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase">Completed: {analyticsData.stats.completed}</span>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase">Dropped: {analyticsData.stats.dropped}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quiz</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Percentage</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Show Results */}
                  {analyticsData.filteredResults.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50 transition-all">
                      <td className="px-8 py-5">
                        <p className="font-bold text-gray-900">{res.studentName}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{res.studentId}</p>
                      </td>
                      <td className="px-8 py-5 font-bold text-gray-700">{res.quizTitle}</td>
                      <td className="px-8 py-5 font-black text-blue-600">{res.score}/{res.totalQuestions}</td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                          res.percentage >= 80 ? 'bg-green-100 text-green-700' :
                          res.percentage >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(res.percentage)}%
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                          res.status === 'marked' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {res.status === 'marked' ? 'Marked' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm text-gray-500 font-medium">
                        {res.completedAt?.toDate().toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {res.status === 'pending_marking' && (isAdmin || isTeacher) && (
                          <button 
                            onClick={() => {
                              setMarkingResult(res);
                              setSeqMarks(res.seqMarks || new Array(res.questions.length).fill(0));
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all"
                          >
                            Mark SEQs
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Show Dropouts */}
                  {analyticsData.dropouts.map((drop) => (
                    <tr key={drop.id} className="bg-red-50/30 hover:bg-red-50/50 transition-all">
                      <td className="px-8 py-5">
                        <p className="font-bold text-gray-900">{drop.studentName}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{drop.studentId}</p>
                      </td>
                      <td className="px-8 py-5 font-bold text-gray-700">{drop.quizTitle}</td>
                      <td className="px-8 py-5 font-black text-gray-400">- / -</td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700">
                          Dropped
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 uppercase">
                          Incomplete
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm text-gray-500 font-medium">
                        {drop.startTime?.toDate().toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">No Action</span>
                      </td>
                    </tr>
                  ))}
                  {analyticsData.filteredResults.length === 0 && analyticsData.dropouts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-8 py-12 text-center text-gray-400 font-medium">No records found for this quiz.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeQuiz ? (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
          {!quizResults ? (
            <div className="p-8 md:p-12">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">{activeQuiz.title}</h2>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}</p>
                </div>
                <div className="flex items-center gap-3 bg-amber-50 px-6 py-3 rounded-2xl border border-amber-100">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="font-black text-amber-600 text-lg">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <span className={`px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest ${
                      activeQuiz.questions[currentQuestionIndex].difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      activeQuiz.questions[currentQuestionIndex].difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {activeQuiz.questions[currentQuestionIndex].difficulty}
                    </span>
                    <span className="px-3 py-1 text-[10px] font-black bg-blue-100 text-blue-700 rounded-lg uppercase tracking-widest">
                      {activeQuiz.questions[currentQuestionIndex].topic}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-8 leading-relaxed">
                    {activeQuiz.questions[currentQuestionIndex].question}
                  </h3>

                  {(activeQuiz.questions[currentQuestionIndex].type === 'mcq' || activeQuiz.questions[currentQuestionIndex].type === 'true-false') ? (
                    <div className="grid gap-4">
                      {activeQuiz.questions[currentQuestionIndex].options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const newAnswers = [...answers];
                            newAnswers[currentQuestionIndex] = idx;
                            setAnswers(newAnswers);
                          }}
                          className={`w-full text-left p-6 rounded-2xl font-bold transition-all border-2 flex items-center gap-4 ${
                            answers[currentQuestionIndex] === idx 
                              ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md' 
                              : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                            answers[currentQuestionIndex] === idx ? 'bg-blue-600 text-white' : 'bg-white text-gray-400'
                          }`}>
                            {activeQuiz.questions[currentQuestionIndex].type === 'true-false' 
                              ? (idx === 0 ? 'T' : 'F')
                              : String.fromCharCode(65 + idx)
                            }
                          </div>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : activeQuiz.questions[currentQuestionIndex].type === 'multi-mcq' ? (
                    <div className="grid gap-4">
                      {activeQuiz.questions[currentQuestionIndex].options.map((option, idx) => {
                        const isSelected = (answers[currentQuestionIndex] as number[]).includes(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              const newAnswers = [...answers];
                              const current = [...(newAnswers[currentQuestionIndex] as number[])];
                              const index = current.indexOf(idx);
                              if (index > -1) current.splice(index, 1);
                              else current.push(idx);
                              newAnswers[currentQuestionIndex] = current;
                              setAnswers(newAnswers);
                            }}
                            className={`w-full text-left p-6 rounded-2xl font-bold transition-all border-2 flex items-center gap-4 ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md' 
                                : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-400'
                            }`}>
                              {isSelected ? <CheckCircle2 className="w-4 h-4" /> : String.fromCharCode(65 + idx)}
                            </div>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Your Answer</label>
                      <textarea 
                        className="w-full h-48 px-6 py-5 bg-gray-50 border-none rounded-[2rem] focus:ring-2 focus:ring-blue-100 font-medium text-gray-700"
                        placeholder="Type your answer here..."
                        value={answers[currentQuestionIndex] as string}
                        onChange={(e) => {
                          const newAnswers = [...answers];
                          newAnswers[currentQuestionIndex] = e.target.value;
                          setAnswers(newAnswers);
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-gray-100">
                  <button
                    disabled={currentQuestionIndex === 0 || activeQuiz.preventBacktracking}
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                    className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-30"
                  >
                    Previous
                  </button>
                  {currentQuestionIndex === activeQuiz.questions.length - 1 ? (
                    <button
                      disabled={
                        (activeQuiz.questions[currentQuestionIndex].type === 'mcq' || activeQuiz.questions[currentQuestionIndex].type === 'true-false')
                          ? answers[currentQuestionIndex] === -1 
                          : activeQuiz.questions[currentQuestionIndex].type === 'multi-mcq'
                            ? (answers[currentQuestionIndex] as number[]).length === 0
                            : (answers[currentQuestionIndex] as string).trim() === ''
                      }
                      onClick={submitQuiz}
                      className="px-12 py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Finish Quiz
                    </button>
                  ) : (
                    <button
                      disabled={
                        (activeQuiz.questions[currentQuestionIndex].type === 'mcq' || activeQuiz.questions[currentQuestionIndex].type === 'true-false')
                          ? answers[currentQuestionIndex] === -1 
                          : activeQuiz.questions[currentQuestionIndex].type === 'multi-mcq'
                            ? (answers[currentQuestionIndex] as number[]).length === 0
                            : (answers[currentQuestionIndex] as string).trim() === ''
                      }
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Question
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
            </div>
          ) : (
            <div className="p-12 max-w-4xl mx-auto">
              <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl ${
                quizResults.percentage >= 50 ? 'bg-green-100 text-green-600 shadow-green-50' : 'bg-red-100 text-red-600 shadow-red-50'
              }`}>
                {quizResults.percentage >= 50 ? <CheckCircle2 className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-2 text-center">Quiz Completed!</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest mb-12 text-center">Your Results</p>
              
              <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto mb-12">
                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 text-center">
                  <p className="text-3xl font-black text-gray-900">{quizResults.score}/{quizResults.totalQuestions}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Score</p>
                </div>
                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 text-center">
                  <p className="text-3xl font-black text-gray-900">{Math.round(quizResults.percentage)}%</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Accuracy</p>
                </div>
              </div>

              {/* Detailed Review Section */}
              <div className="space-y-8 mb-12 text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Detailed Review</h3>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>

                {quizResults.questions.map((q: any, idx: number) => {
                  // Parse userAnswers if it's a string (new format)
                  const userAnswers = typeof quizResults.userAnswers === 'string' 
                    ? JSON.parse(quizResults.userAnswers) 
                    : quizResults.userAnswers;
                  const userAnswer = userAnswers[idx];
                  const isCorrect = userAnswer === q.correctAnswer;

                  return (
                    <div key={idx} className={`p-8 rounded-[2rem] border ${isCorrect ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100'}`}>
                      <div className="flex items-start gap-4 mb-6">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                          isCorrect ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{q.type.replace('-', ' ')}</span>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">• {q.topic}</span>
                          </div>
                          <h4 className="text-lg font-bold text-gray-800 leading-relaxed">{q.question}</h4>
                        </div>
                      </div>

                        {(q.type === 'mcq' || q.type === 'true-false' || q.type === 'multi-mcq') ? (
                          <div className="grid gap-3 ml-12">
                            {q.options.map((option: string, optIdx: number) => {
                              const isUserChoice = q.type === 'multi-mcq' 
                                ? (userAnswer as number[]).includes(optIdx)
                                : userAnswer === optIdx;
                              
                              const isCorrectChoice = q.type === 'multi-mcq'
                                ? (q.correctAnswer as number[]).includes(optIdx)
                                : q.correctAnswer === optIdx;

                              let statusClass = 'bg-white text-gray-500 border-gray-100';
                              if (isCorrectChoice) statusClass = 'bg-green-100 text-green-700 border-green-200 ring-2 ring-green-500/20';
                              if (isUserChoice && !isCorrectChoice) statusClass = 'bg-red-100 text-red-700 border-red-200 ring-2 ring-red-500/20';

                              return (
                                <div 
                                  key={optIdx} 
                                  className={`p-4 rounded-xl border text-sm font-bold flex items-center justify-between ${statusClass}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="opacity-50">
                                      {q.type === 'true-false' ? (optIdx === 0 ? 'T' : 'F') : String.fromCharCode(65 + optIdx)}
                                    </span>
                                    {option}
                                  </div>
                                  {isCorrectChoice && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                  {isUserChoice && !isCorrectChoice && <XCircle className="w-4 h-4 text-red-600" />}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="ml-12 space-y-4">
                            <div className="p-6 bg-white rounded-2xl border border-gray-100">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Your Answer</p>
                              <p className="text-gray-700 font-medium whitespace-pre-wrap">{userAnswer || 'No answer provided.'}</p>
                            </div>
                            {q.type === 'short-answer' && (
                              <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                                <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">Correct Answer / Keywords</p>
                                <p className="text-green-800 font-bold">{q.correctAnswer}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="mt-6 ml-12 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                            <Info className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Explanation</p>
                              <p className="text-xs text-amber-800 font-medium leading-relaxed">{q.explanation}</p>
                            </div>
                          </div>
                        )}
                        
                        {q.type === 'mcq' && !isCorrect && (
                          <div className="mt-6 ml-12 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1">Correct Answer</p>
                            <p className="text-sm font-bold text-blue-900">
                              {String.fromCharCode(65 + q.correctAnswer)}) {q.options[q.correctAnswer]}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              <button
                onClick={() => setActiveQuiz(null)}
                className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                Back to Quizzes
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} className="h-64 bg-white rounded-3xl border border-gray-100 animate-pulse"></div>
            ))
          ) : quizzes.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-6">
                <BrainCircuit className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Quizzes Available</h3>
              <p className="text-gray-500 font-medium">Check back later for new exams and quizzes.</p>
            </div>
          ) : (
            quizzes.map((quiz) => {
              const isOpen = (!quiz.startTime || currentTime >= quiz.startTime.toDate()) && (!quiz.endTime || currentTime <= quiz.endTime.toDate());
              const isFuture = quiz.startTime && currentTime < quiz.startTime.toDate();
              const isExpired = quiz.endTime && currentTime > quiz.endTime.toDate();

              // Calculate countdown for future quizzes
              let countdownText = '';
              if (isFuture) {
                const diff = quiz.startTime!.toDate().getTime() - currentTime.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                countdownText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              }

              return (
                <motion.div
                  key={quiz.id}
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
                >
                  {isFuture && (
                    <div className="absolute top-4 right-4 bg-amber-50 text-amber-600 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest flex flex-col items-center gap-0.5 border border-amber-100 shadow-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Opens In</span>
                      </div>
                      <span className="text-sm font-mono">{countdownText}</span>
                    </div>
                  )}
                  {isExpired && (
                    <div className="absolute top-4 right-4 bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-gray-200">
                      <AlertCircle className="w-3 h-3" />
                      Closed
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <ListChecks className="w-7 h-7" />
                    </div>
                    {(profile.role === 'admin' || profile.role === 'teacher') && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditQuiz(quiz)}
                          className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                          title="Edit Quiz"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteQuiz(quiz.id)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Quiz"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight pr-24">{quiz.title}</h3>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs font-bold uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" />
                      {quiz.timeLimit} Mins
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs font-bold uppercase tracking-widest">
                      <ListChecks className="w-3.5 h-3.5" />
                      {quiz.questions.length} Qs
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => startQuiz(quiz)}
                      disabled={!isOpen}
                      className="flex-1 py-4 bg-gray-50 text-blue-600 rounded-2xl font-black hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <Play className="w-5 h-5" />
                      {isFuture ? 'Waiting...' : isExpired ? 'Closed' : 'Start Quiz'}
                    </button>
                    <button
                      onClick={() => downloadQuizPDF(quiz)}
                      className="px-4 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black hover:bg-gray-100 hover:text-gray-700 transition-all flex items-center justify-center group/btn"
                      title="Download PDF"
                    >
                      <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Marking Modal */}
      <AnimatePresence>
        {markingResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden my-8"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Mark SEQs</h2>
                  <p className="text-sm text-gray-500 font-medium">{markingResult.studentName} - {markingResult.quizTitle}</p>
                </div>
                <button onClick={() => setMarkingResult(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {markingResult.questions.map((q: any, idx: number) => {
                  // Parse userAnswers if it's a string
                  const userAnswers = typeof markingResult.userAnswers === 'string'
                    ? JSON.parse(markingResult.userAnswers)
                    : markingResult.userAnswers;
                  
                  return (
                  <div key={idx} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">
                            {q.type}
                          </span>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {idx + 1}</label>
                        </div>
                        <p className="text-lg font-bold text-gray-900 mb-4">{q.question}</p>
                        
                        {q.type === 'mcq' ? (
                          <div className="p-4 bg-white rounded-xl border border-gray-100">
                            <p className="text-sm font-bold text-gray-600">
                              Student Answer: {String.fromCharCode(65 + userAnswers[idx])}) {q.options[userAnswers[idx]]}
                            </p>
                            <p className={`text-xs font-black mt-2 uppercase tracking-widest ${
                              userAnswers[idx] === q.correctAnswer ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {userAnswers[idx] === q.correctAnswer ? 'Correct (+1)' : 'Incorrect (0)'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-6 bg-white rounded-2xl border border-gray-100">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Student's Answer</p>
                              <p className="text-gray-700 font-medium whitespace-pre-wrap">{userAnswers[idx] || 'No answer provided.'}</p>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Assign Marks (0-1)</label>
                              <input 
                                type="number" 
                                min="0"
                                max="1"
                                step="0.1"
                                className="w-32 px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                                value={seqMarks[idx]}
                                onChange={(e) => {
                                  const updated = [...seqMarks];
                                  updated[idx] = parseFloat(e.target.value) || 0;
                                  setSeqMarks(updated);
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>

              <div className="p-8 border-t border-gray-100 flex gap-4">
                <button 
                  onClick={() => setMarkingResult(null)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleMarkingSubmit}
                  className="flex-[2] py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Submit Marks
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden my-8"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  {editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
                </h2>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setEditingQuiz(null);
                }} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateQuiz} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Quiz Title</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      placeholder="Midterm Exam 2024"
                      value={newQuiz.title}
                      onChange={(e) => setNewQuiz({...newQuiz, title: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Time Limit (Mins)</label>
                      <input 
                        required
                        type="number" 
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                        value={newQuiz.timeLimit}
                        onChange={(e) => setNewQuiz({...newQuiz, timeLimit: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Attempts Limit</label>
                      <input 
                        required
                        type="number" 
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                        value={newQuiz.attemptsLimit}
                        onChange={(e) => setNewQuiz({...newQuiz, attemptsLimit: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Course</label>
                    <select 
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={newQuiz.courseId}
                      onChange={(e) => setNewQuiz({...newQuiz, courseId: e.target.value})}
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                    <select 
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={newQuiz.subjectId}
                      onChange={(e) => setNewQuiz({...newQuiz, subjectId: e.target.value})}
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100/50">
                  <div className="col-span-full">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest">Quiz Schedule Settings</h4>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex justify-between">
                      <span>Start Time</span>
                      {newQuiz.startTime && (
                        <span className="text-blue-600 lowercase font-bold tracking-normal italic">
                          Quiz will open at: {format(new Date(newQuiz.startTime), 'p, MMM d')}
                        </span>
                      )}
                    </label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-5 py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl font-bold text-gray-900 shadow-sm transition-all"
                      value={newQuiz.startTime}
                      onChange={(e) => setNewQuiz({...newQuiz, startTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex justify-between">
                      <span>End Time</span>
                      {newQuiz.endTime && (
                        <span className="text-red-500 lowercase font-bold tracking-normal italic">
                          Quiz will close at: {format(new Date(newQuiz.endTime), 'p, MMM d')}
                        </span>
                      )}
                    </label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-5 py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl font-bold text-gray-900 shadow-sm transition-all"
                      value={newQuiz.endTime}
                      onChange={(e) => setNewQuiz({...newQuiz, endTime: e.target.value})}
                    />
                  </div>
                  {!newQuiz.startTime && (
                    <div className="col-span-full flex items-center gap-2 text-[10px] text-gray-400 font-bold italic">
                      <AlertCircle className="w-3 h-3" />
                      If no start time is set, the quiz will be available immediately.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-6 p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={newQuiz.shuffleQuestions}
                      onChange={(e) => setNewQuiz({...newQuiz, shuffleQuestions: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-gray-700">Shuffle Questions</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={newQuiz.shuffleOptions}
                      onChange={(e) => setNewQuiz({...newQuiz, shuffleOptions: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-gray-700">Shuffle Options</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={newQuiz.preventBacktracking}
                      onChange={(e) => setNewQuiz({...newQuiz, preventBacktracking: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-gray-700">Prevent Backtracking</span>
                  </label>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-gray-900">Questions</h3>
                      <div className="flex flex-wrap gap-3">
                        <button 
                          type="button"
                          onClick={() => setIsBulkMode(!isBulkMode)}
                          className={`text-xs font-black px-4 py-2 rounded-xl transition-all uppercase tracking-widest ${
                            isBulkMode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {isBulkMode ? 'Cancel Bulk' : 'Bulk Import'}
                        </button>
                        <select 
                          className="bg-blue-50 text-blue-600 font-black text-[10px] px-4 py-2 rounded-xl uppercase tracking-widest hover:bg-blue-100 transition-all border-none focus:ring-0"
                          onChange={(e) => {
                            if (e.target.value) {
                              addQuestion(e.target.value);
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">+ Add Question</option>
                          <option value="mcq">MCQ (Single)</option>
                          <option value="multi-mcq">MCQ (Multiple)</option>
                          <option value="true-false">True/False</option>
                          <option value="short-answer">Short Answer</option>
                          <option value="long-answer">Long Answer</option>
                        </select>
                      </div>
                  </div>

                  {isBulkMode ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                        <h4 className="text-sm font-black text-blue-800 mb-2 uppercase tracking-widest">Bulk Import Guide</h4>
                        <p className="text-xs text-blue-600 leading-relaxed font-medium">
                          Paste your questions and options below. After parsing, you will be able to select the correct answer for each MCQ manually in the next step.
                        </p>
                        <div className="mt-4 p-4 bg-white/50 rounded-xl text-[10px] font-mono text-blue-700">
                          1. What is the capital of France?<br/>
                          A) London<br/>
                          B) Paris<br/>
                          C) Berlin<br/>
                          D) Rome
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Paste Questions & Options</label>
                        <textarea 
                          className="w-full h-96 px-6 py-5 bg-gray-50 border-none rounded-[2rem] focus:ring-2 focus:ring-blue-100 font-medium text-gray-700"
                          placeholder="Paste your questions and options here..."
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                        />
                      </div>

                      <button 
                        type="button"
                        onClick={parseBulkQuestions}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                      >
                        Parse Questions & Arrange Answers
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {newQuiz.questions.length > 0 && (
                        <div className="flex justify-end">
                          <button 
                            type="button"
                            onClick={() => {
                              if (window.confirm('Clear all questions?')) {
                                setNewQuiz({ ...newQuiz, questions: [] });
                              }
                            }}
                            className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                      {newQuiz.questions.map((q, qIdx) => (
                        <div key={qIdx} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4 relative group">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className={`px-2 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest ${
                                  q.type.includes('mcq') ? 'bg-blue-600 text-white' : 
                                  q.type === 'true-false' ? 'bg-green-600 text-white' :
                                  'bg-indigo-600 text-white'
                                }`}>
                                  {q.type.replace('-', ' ')}
                                </span>
                                <select 
                                  className="text-[10px] font-black bg-white border border-gray-200 rounded-lg px-2 py-1 uppercase tracking-widest"
                                  value={q.difficulty}
                                  onChange={(e) => updateQuestion(qIdx, 'difficulty', e.target.value)}
                                >
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                                <input 
                                  type="text"
                                  placeholder="Topic (e.g. Anatomy)"
                                  className="text-[10px] font-black bg-white border border-gray-200 rounded-lg px-2 py-1 uppercase tracking-widest w-32"
                                  value={q.topic}
                                  onChange={(e) => updateQuestion(qIdx, 'topic', e.target.value)}
                                />
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {qIdx + 1}</label>
                              </div>
                              <textarea 
                                required
                                rows={2}
                                className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 resize-none"
                                placeholder="Enter question text..."
                                value={q.question}
                                onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                              />
                              <input 
                                type="text"
                                placeholder="Explanation (Optional)"
                                className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-medium text-gray-600"
                                value={q.explanation}
                                onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <button 
                                type="button"
                                onClick={() => {
                                  const updated = newQuiz.questions.filter((_, i) => i !== qIdx);
                                  setNewQuiz({ ...newQuiz, questions: updated });
                                }}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {(q.type === 'mcq' || q.type === 'multi-mcq' || q.type === 'true-false') ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                  Options ({q.type === 'multi-mcq' ? 'Select All Correct' : 'Select Correct Answer'})
                                </label>
                                {((q.type === 'multi-mcq' && q.correctAnswer.length === 0) || (q.type !== 'multi-mcq' && q.correctAnswer === -1)) && (
                                  <span className="text-[10px] font-black text-red-500 animate-pulse">Select Answer!</span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {q.options.map((opt, oIdx) => {
                                  const isSelected = q.type === 'multi-mcq' 
                                    ? q.correctAnswer.includes(oIdx)
                                    : q.correctAnswer === oIdx;

                                  return (
                                    <div 
                                      key={oIdx} 
                                      onClick={() => {
                                        if (q.type === 'multi-mcq') {
                                          const current = [...q.correctAnswer];
                                          const index = current.indexOf(oIdx);
                                          if (index > -1) current.splice(index, 1);
                                          else current.push(oIdx);
                                          updateQuestion(qIdx, 'correctAnswer', current);
                                        } else {
                                          updateQuestion(qIdx, 'correctAnswer', oIdx);
                                        }
                                      }}
                                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                        isSelected 
                                          ? 'bg-green-50 border-green-500 shadow-md' 
                                          : 'bg-white border-transparent hover:border-gray-200'
                                      }`}
                                    >
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isSelected ? 'bg-green-500 border-green-500' : 'border-gray-200'
                                      }`}>
                                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                      </div>
                                      <input 
                                        required
                                        type="text" 
                                        className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-bold text-gray-900"
                                        placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                        value={opt}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : q.type === 'short-answer' ? (
                            <div className="space-y-4">
                              <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest">Correct Answer / Keywords</label>
                              <input 
                                type="text"
                                className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl font-bold text-gray-900"
                                placeholder="Enter correct answer or comma-separated keywords..."
                                value={q.correctAnswer}
                                onChange={(e) => updateQuestion(qIdx, 'correctAnswer', e.target.value)}
                              />
                              <p className="text-[10px] text-gray-400 font-medium italic">System will auto-grade based on these keywords.</p>
                            </div>
                          ) : (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                              <p className="text-xs font-bold text-blue-600 italic">Long Answer Question - This will require manual marking by a teacher.</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-4 sticky bottom-0 bg-white py-4 border-t border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {editingQuiz ? 'Update Quiz' : 'Save Quiz'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
