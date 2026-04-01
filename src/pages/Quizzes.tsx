import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, Timestamp, query, where, addDoc, onSnapshot } from '../lib/firebase';
import { BrainCircuit, Plus, Trash2, Clock, CheckCircle2, XCircle, ChevronRight, Play, Save, ListChecks, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../App';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  type: 'mcq' | 'seq';
}

interface Quiz {
  id: string;
  title: string;
  courseId: string;
  subjectId: string;
  questions: Question[];
  timeLimit: number;
  createdAt: Timestamp;
  createdBy: string;
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [markingResult, setMarkingResult] = useState<any>(null);
  const [seqMarks, setSeqMarks] = useState<number[]>([]);

  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';

  // New Quiz Form State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkAnswersText, setBulkAnswersText] = useState('');
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    courseId: '',
    subjectId: '',
    timeLimit: 30,
    questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, type: 'mcq' as 'mcq' | 'seq' }]
  });

  const parseBulkQuestions = () => {
    const questions: Question[] = [];
    const blocks = bulkText.split(/\n\s*\n/);

    // Parse Answer Key
    const answerKey: (number | null)[] = [];
    if (bulkAnswersText.trim()) {
      const answerLines = bulkAnswersText.split('\n').map(l => l.trim()).filter(l => l !== '');
      answerLines.forEach((line, idx) => {
        const match = line.match(/^(\d+)[.\)]\s*([A-D])/i);
        if (match) {
          const qNum = parseInt(match[1]);
          const letter = match[2].toUpperCase();
          answerKey[qNum - 1] = letter.charCodeAt(0) - 65;
        } else {
          const letterMatch = line.match(/^([A-D])/i);
          if (letterMatch) {
            const letter = letterMatch[1].toUpperCase();
            answerKey[idx] = letter.charCodeAt(0) - 65;
          }
        }
      });
    }

    blocks.forEach((block, index) => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (lines.length < 2) return;

      const questionText = lines[0].replace(/^\d+[\.\)]\s*/, '');
      const options: string[] = [];
      let correctAnswer = -1;

      lines.slice(1).forEach(line => {
        const optionMatch = line.match(/^([A-D])[\.\)]\s*(.*)/i);
        if (optionMatch) {
          options.push(optionMatch[2]);
        } else {
          const answerMatch = line.match(/^(?:Answer|Correct|Ans):\s*([A-D])/i);
          if (answerMatch) {
            const letter = answerMatch[1].toUpperCase();
            correctAnswer = letter.charCodeAt(0) - 65;
          }
        }
      });

      // Override with answer key if provided for this index
      if (answerKey[index] !== undefined && answerKey[index] !== null) {
        correctAnswer = answerKey[index]!;
      }

      if (options.length >= 2) {
        // Fill up to 4 options if less
        while (options.length < 4) options.push('');
        
        questions.push({
          question: questionText,
          options: options.slice(0, 4),
          correctAnswer: correctAnswer >= 0 && correctAnswer < options.length ? correctAnswer : 0,
          type: 'mcq'
        });
      }
    });

    if (questions.length > 0) {
      setNewQuiz({ ...newQuiz, questions });
      setIsBulkMode(false);
      setBulkText('');
      setBulkAnswersText('');
    } else {
      alert('Could not parse any questions. Please check the format.');
    }
  };

  useEffect(() => {
    fetchQuizzes();
    fetchCourses();
    fetchSubjects();
    
    let unsubscribeResults: (() => void) | undefined;
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
    }

    return () => {
      if (unsubscribeResults) unsubscribeResults();
    };
  }, [profile.role]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'quizzes'));
      const quizzesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
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

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const quizData = {
        ...newQuiz,
        createdAt: Timestamp.now(),
        createdBy: profile.uid
      };
      await addDoc(collection(db, 'quizzes'), quizData);
      setIsModalOpen(false);
      setNewQuiz({
        title: '',
        courseId: '',
        subjectId: '',
        timeLimit: 30,
        questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, type: 'mcq' }]
      });
      fetchQuizzes();
    } catch (error) {
      console.error('Error creating quiz:', error);
    }
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

  const addQuestion = (type: 'mcq' | 'seq' = 'mcq') => {
    setNewQuiz({
      ...newQuiz,
      questions: [...newQuiz.questions, { 
        question: '', 
        options: type === 'mcq' ? ['', '', '', ''] : [], 
        correctAnswer: 0, 
        type 
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
  const [answers, setAnswers] = useState<(number | string)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);

  const startQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIndex(0);
    setAnswers(quiz.questions.map(q => q.type === 'mcq' ? -1 : ''));
    setTimeLeft(quiz.timeLimit * 60);
    setQuizResults(null);
  };

  useEffect(() => {
    if (activeQuiz && timeLeft > 0 && !quizResults) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && activeQuiz && !quizResults) {
      submitQuiz();
    }
  }, [activeQuiz, timeLeft, quizResults]);

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    let score = 0;
    let mcqCount = 0;
    let hasSeq = false;

    activeQuiz.questions.forEach((q, i) => {
      if (q.type === 'mcq') {
        mcqCount++;
        if (answers[i] === q.correctAnswer) score++;
      } else {
        hasSeq = true;
      }
    });
    
    const resultData = {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      studentId: profile.uid,
      studentName: profile.name,
      score,
      totalQuestions: activeQuiz.questions.length,
      mcqCount,
      percentage: mcqCount > 0 ? (score / mcqCount) * 100 : 0,
      completedAt: Timestamp.now(),
      userAnswers: answers,
      questions: activeQuiz.questions,
      status: hasSeq ? 'pending_marking' : 'marked',
      seqMarks: hasSeq ? new Array(activeQuiz.questions.length).fill(0) : []
    };

    try {
      await addDoc(collection(db, 'quiz_results'), resultData);
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
  const getTopScorers = () => {
    const studentScores: { [key: string]: { name: string, totalScore: number, quizzesTaken: number } } = {};
    
    allResults.forEach(res => {
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

  const topScorers = getTopScorers();

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
              setShowLeaderboard(!showLeaderboard);
              setShowAnalytics(false);
            }}
            className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
              showLeaderboard ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Leaderboard
          </button>
          {(profile.role === 'admin' || profile.role === 'teacher') && (
            <>
              <button 
                onClick={() => {
                  setShowAnalytics(!showAnalytics);
                  setShowLeaderboard(false);
                }}
                className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                  showAnalytics ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <BrainCircuit className="w-5 h-5" />
                {showAnalytics ? 'View Quizzes' : 'View Analytics'}
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Quiz
              </button>
            </>
          )}
        </div>
      </div>

      {showLeaderboard ? (
        <div className="space-y-8">
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
                  {scorer.average}% Average
                </p>
                <div className={`mt-4 inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  idx === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {scorer.quizzes} Quizzes Taken
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">Top Performers</h2>
              <p className="text-sm text-gray-500 font-medium">The brightest minds of the academy</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rank</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Avg. Score</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Quizzes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topScorers.map((scorer, idx) => (
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
                        {scorer.quizzes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : showAnalytics ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-gray-100">
            <h2 className="text-xl font-black text-gray-900">Quiz Analytics</h2>
            <p className="text-sm text-gray-500 font-medium">Track student performance across all quizzes</p>
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
                {allResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-medium">No results recorded yet.</td>
                  </tr>
                ) : (
                  allResults.map((res) => (
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
                  ))
                )}
              </tbody>
            </table>
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
                <h3 className="text-xl font-bold text-gray-800 mb-8 leading-relaxed">
                  {activeQuiz.questions[currentQuestionIndex].question}
                </h3>
                {activeQuiz.questions[currentQuestionIndex].type === 'mcq' ? (
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
                          {String.fromCharCode(65 + idx)}
                        </div>
                        {option}
                      </button>
                    ))}
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
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                  className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-30"
                >
                  Previous
                </button>
                {currentQuestionIndex === activeQuiz.questions.length - 1 ? (
                  <button
                    disabled={
                      activeQuiz.questions[currentQuestionIndex].type === 'mcq' 
                        ? answers[currentQuestionIndex] === -1 
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
                      activeQuiz.questions[currentQuestionIndex].type === 'mcq' 
                        ? answers[currentQuestionIndex] === -1 
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
                  const userAnswer = quizResults.userAnswers[idx];
                  const isCorrect = userAnswer === q.correctAnswer;

                  return (
                    <div key={idx} className={`p-8 rounded-[2rem] border ${isCorrect ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100'}`}>
                      <div className="flex items-start gap-4 mb-6">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                          isCorrect ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <h4 className="text-lg font-bold text-gray-800 leading-relaxed">{q.question}</h4>
                      </div>

                        {q.type === 'mcq' ? (
                          <div className="grid gap-3 ml-12">
                            {q.options.map((option: string, optIdx: number) => {
                              const isUserChoice = userAnswer === optIdx;
                              const isCorrectChoice = q.correctAnswer === optIdx;

                              let statusClass = 'bg-white text-gray-500 border-gray-100';
                              if (isCorrectChoice) statusClass = 'bg-green-100 text-green-700 border-green-200 ring-2 ring-green-500/20';
                              if (isUserChoice && !isCorrect) statusClass = 'bg-red-100 text-red-700 border-red-200 ring-2 ring-red-500/20';

                              return (
                                <div 
                                  key={optIdx} 
                                  className={`p-4 rounded-xl border text-sm font-bold flex items-center justify-between ${statusClass}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="opacity-50">{String.fromCharCode(65 + optIdx)})</span>
                                    {option}
                                  </div>
                                  {isCorrectChoice && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                  {isUserChoice && !isCorrect && <XCircle className="w-4 h-4 text-red-600" />}
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
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                              <span className="text-sm font-bold text-blue-700">Marks Assigned:</span>
                              <span className="text-lg font-black text-blue-700">
                                {quizResults.status === 'pending_marking' ? 'Pending' : `${quizResults.seqMarks?.[idx] || 0} Marks`}
                              </span>
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
            quizzes.map((quiz) => (
              <motion.div
                key={quiz.id}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ListChecks className="w-7 h-7" />
                  </div>
                  {(profile.role === 'admin' || profile.role === 'teacher') && (
                    <button 
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">{quiz.title}</h3>
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

                <button
                  onClick={() => startQuiz(quiz)}
                  className="w-full py-4 bg-gray-50 text-blue-600 rounded-2xl font-black hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Quiz
                </button>
              </motion.div>
            ))
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
                {markingResult.questions.map((q: any, idx: number) => (
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
                              Student Answer: {String.fromCharCode(65 + markingResult.userAnswers[idx])}) {q.options[markingResult.userAnswers[idx]]}
                            </p>
                            <p className={`text-xs font-black mt-2 uppercase tracking-widest ${
                              markingResult.userAnswers[idx] === q.correctAnswer ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {markingResult.userAnswers[idx] === q.correctAnswer ? 'Correct (+1)' : 'Incorrect (0)'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-6 bg-white rounded-2xl border border-gray-100">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Student's Answer</p>
                              <p className="text-gray-700 font-medium whitespace-pre-wrap">{markingResult.userAnswers[idx] || 'No answer provided.'}</p>
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
                ))}
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
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Create New Quiz</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
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
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Time Limit (Minutes)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={newQuiz.timeLimit}
                      onChange={(e) => setNewQuiz({...newQuiz, timeLimit: parseInt(e.target.value)})}
                    />
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

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-gray-900">Questions</h3>
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setIsBulkMode(!isBulkMode)}
                        className={`text-xs font-black px-4 py-2 rounded-xl transition-all uppercase tracking-widest ${
                          isBulkMode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {isBulkMode ? 'Cancel Bulk' : 'Bulk Import'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => addQuestion('mcq')}
                        className="bg-blue-50 text-blue-600 font-black text-[10px] px-4 py-2 rounded-xl uppercase tracking-widest hover:bg-blue-100 transition-all"
                      >
                        + Add MCQ
                      </button>
                      <button 
                        type="button"
                        onClick={() => addQuestion('seq')}
                        className="bg-indigo-50 text-indigo-600 font-black text-[10px] px-4 py-2 rounded-xl uppercase tracking-widest hover:bg-indigo-100 transition-all"
                      >
                        + Add SEQ
                      </button>
                    </div>
                  </div>

                  {isBulkMode ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                        <h4 className="text-sm font-black text-blue-800 mb-2 uppercase tracking-widest">Bulk Import Guide</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                            <span className="font-black">Questions & Options:</span><br/>
                            1. What is the capital of France?<br/>
                            A) London<br/>
                            B) Paris<br/>
                            C) Berlin<br/>
                            D) Rome
                          </p>
                          <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                            <span className="font-black">Answer Key (Optional):</span><br/>
                            1. B<br/>
                            2. A<br/>
                            3. C<br/>
                            (Or just paste a list: B, A, C)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Questions & Options</label>
                          <textarea 
                            className="w-full h-80 px-6 py-5 bg-gray-50 border-none rounded-[2rem] focus:ring-2 focus:ring-blue-100 font-medium text-gray-700"
                            placeholder="Paste questions and options here..."
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Answer Key (Optional)</label>
                          <textarea 
                            className="w-full h-80 px-6 py-5 bg-gray-50 border-none rounded-[2rem] focus:ring-2 focus:ring-blue-100 font-medium text-gray-700"
                            placeholder="Paste answer key here (e.g., 1. A, 2. B or just A, B, C)..."
                            value={bulkAnswersText}
                            onChange={(e) => setBulkAnswersText(e.target.value)}
                          />
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={parseBulkQuestions}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                      >
                        Parse & Arrange Questions
                      </button>
                    </div>
                  ) : (
                    newQuiz.questions.map((q, qIdx) => (
                    <div key={qIdx} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {qIdx + 1}</label>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => updateQuestion(qIdx, 'type', 'mcq')}
                                className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest transition-all ${
                                  q.type === 'mcq' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                MCQ
                              </button>
                              <button 
                                type="button"
                                onClick={() => updateQuestion(qIdx, 'type', 'seq')}
                                className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest transition-all ${
                                  q.type === 'seq' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                SEQ
                              </button>
                            </div>
                          </div>
                          <input 
                            required
                            type="text" 
                            className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                            placeholder="Enter question text..."
                            value={q.question}
                            onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                          />
                        </div>
                        {newQuiz.questions.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const updated = newQuiz.questions.filter((_, i) => i !== qIdx);
                              setNewQuiz({ ...newQuiz, questions: updated });
                            }}
                            className="mt-6 p-2 text-red-400 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {q.type === 'mcq' ? (
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Options & Answer Key</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.options.map((opt, oIdx) => (
                              <div 
                                key={oIdx} 
                                className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                                  q.correctAnswer === oIdx ? 'bg-green-50 border-green-200' : 'bg-white border-transparent'
                                }`}
                              >
                                <input 
                                  type="radio"
                                  name={`correct-${qIdx}`}
                                  checked={q.correctAnswer === oIdx}
                                  onChange={() => updateQuestion(qIdx, 'correctAnswer', oIdx)}
                                  className="w-5 h-5 text-green-600 focus:ring-green-500"
                                />
                                <div className="flex-1">
                                  <input 
                                    required
                                    type="text" 
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-gray-900 placeholder:text-gray-300"
                                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                    value={opt}
                                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                                  />
                                </div>
                                {q.correctAnswer === oIdx && (
                                  <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-600 italic">This is a Short Essay Question (SEQ). Students will provide a written answer.</p>
                        </div>
                      )}
                    </div>
                  ))
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
                    Save Quiz
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
