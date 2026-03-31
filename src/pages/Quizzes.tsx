import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, Timestamp, query, where, addDoc } from '../lib/firebase';
import { BrainCircuit, Plus, Trash2, Clock, CheckCircle2, XCircle, ChevronRight, Play, Save, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../App';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
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

  // New Quiz Form State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    courseId: '',
    subjectId: '',
    timeLimit: 30,
    questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]
  });

  const parseBulkQuestions = () => {
    const questions: Question[] = [];
    const blocks = bulkText.split(/\n\s*\n/);

    blocks.forEach(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (lines.length < 3) return;

      const questionText = lines[0].replace(/^\d+[\.\)]\s*/, '');
      const options: string[] = [];
      let correctAnswer = 0;

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

      if (options.length >= 2) {
        // Fill up to 4 options if less
        while (options.length < 4) options.push('');
        
        questions.push({
          question: questionText,
          options: options.slice(0, 4),
          correctAnswer: correctAnswer >= 0 && correctAnswer < options.length ? correctAnswer : 0
        });
      }
    });

    if (questions.length > 0) {
      setNewQuiz({ ...newQuiz, questions });
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
    if (profile.role === 'admin' || profile.role === 'teacher') {
      fetchAllResults();
    }
  }, []);

  const fetchAllResults = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'quiz_results'));
      setAllResults(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

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
        questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]
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

  const addQuestion = () => {
    setNewQuiz({
      ...newQuiz,
      questions: [...newQuiz.questions, { question: '', options: ['', '', '', ''], correctAnswer: 0 }]
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
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);

  const startQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIndex(0);
    setAnswers(new Array(quiz.questions.length).fill(-1));
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
    activeQuiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) score++;
    });
    
    const resultData = {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      studentId: profile.uid,
      studentName: profile.name,
      score,
      totalQuestions: activeQuiz.questions.length,
      percentage: (score / activeQuiz.questions.length) * 100,
      completedAt: Timestamp.now()
    };

    try {
      await addDoc(collection(db, 'quiz_results'), resultData);
      setQuizResults(resultData);
      if (profile.role === 'admin' || profile.role === 'teacher') {
        fetchAllResults();
      }
    } catch (error) {
      console.error('Error saving result:', error);
      setQuizResults(resultData);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Quizzes & Exams</h1>
          <p className="text-gray-500 font-medium">Test your knowledge and track progress</p>
        </div>
        <div className="flex gap-3">
          {(profile.role === 'admin' || profile.role === 'teacher') && (
            <>
              <button 
                onClick={() => setShowAnalytics(!showAnalytics)}
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

      {showAnalytics ? (
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
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
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
                      <td className="px-8 py-5 text-sm text-gray-500 font-medium">
                        {res.completedAt?.toDate().toLocaleDateString()}
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
                    onClick={submitQuiz}
                    className="px-12 py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all"
                  >
                    Finish Quiz
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    Next Question
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl ${
                quizResults.percentage >= 50 ? 'bg-green-100 text-green-600 shadow-green-50' : 'bg-red-100 text-red-600 shadow-red-50'
              }`}>
                {quizResults.percentage >= 50 ? <CheckCircle2 className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-2">Quiz Completed!</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest mb-12">Your Results</p>
              
              <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto mb-12">
                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                  <p className="text-3xl font-black text-gray-900">{quizResults.score}/{quizResults.total}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Score</p>
                </div>
                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                  <p className="text-3xl font-black text-gray-900">{Math.round(quizResults.percentage)}%</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Accuracy</p>
                </div>
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

      {/* Create Quiz Modal */}
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
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setIsBulkMode(!isBulkMode)}
                        className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${
                          isBulkMode ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {isBulkMode ? 'Cancel Bulk Import' : 'Bulk Import (Paste)'}
                      </button>
                      <button 
                        type="button"
                        onClick={addQuestion}
                        className="text-blue-600 font-bold text-sm hover:underline"
                      >
                        + Add Question
                      </button>
                    </div>
                  </div>

                  {isBulkMode ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                        <h4 className="text-sm font-black text-blue-800 mb-2 uppercase tracking-widest">Format Guide</h4>
                        <p className="text-xs text-blue-600 leading-relaxed font-medium">
                          Paste your questions in this format (separate questions with an empty line):<br/>
                          1. What is the capital of France?<br/>
                          A) London<br/>
                          B) Paris<br/>
                          C) Berlin<br/>
                          D) Rome<br/>
                          Answer: B
                        </p>
                      </div>
                      <textarea 
                        className="w-full h-80 px-6 py-5 bg-gray-50 border-none rounded-[2rem] focus:ring-2 focus:ring-blue-100 font-medium text-gray-700"
                        placeholder="Paste your questions here..."
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                      />
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
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Question {qIdx + 1}</label>
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-3">
                            <input 
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correctAnswer === oIdx}
                              onChange={() => updateQuestion(qIdx, 'correctAnswer', oIdx)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <input 
                              required
                              type="text" 
                              className="flex-1 px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-gray-700"
                              placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                              value={opt}
                              onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
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
