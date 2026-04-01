import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, query, where, Timestamp, deleteDoc } from '../lib/firebase';
import { FileText, Plus, Search, Calendar, Clock, CheckCircle2, Upload, Trash2, Edit2, User, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  title: string;
  description: string;
  courseId: string;
  subjectId: string;
  dueDate: Timestamp;
  type: 'assignment' | 'quiz';
}

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  fileUrl: string;
  submittedAt: Timestamp;
  grade?: string;
}

interface Course {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  courseId: string;
}

export default function Assignments({ profile }: { profile: any }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; title: string } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    subjectId: '',
    dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    type: 'assignment' as const
  });

  const [submissionData, setSubmissionData] = useState({
    fileUrl: ''
  });

  const isTeacher = profile.role === 'teacher';
  const isAdmin = profile.role === 'admin';
  const isStudent = profile.role === 'student';

  const fetchData = async () => {
    setLoading(true);
    try {
      const assignmentsSnap = await getDocs(collection(db, 'assignments'));
      const submissionsSnap = await getDocs(collection(db, 'submissions'));
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const subjectsSnap = await getDocs(collection(db, 'subjects'));

      setAssignments(assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)));
      setSubmissions(submissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'assignments', id), {
        id,
        ...formData,
        dueDate: Timestamp.fromDate(new Date(formData.dueDate))
      });
      setIsModalOpen(false);
      setFormData({ title: '', description: '', courseId: '', subjectId: '', dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), type: 'assignment' });
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<{ id: string; title: string; progress: number; status: 'reading' | 'saving' | 'complete' | 'error'; error?: string }[]>([]);

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    const fileInput = (e.target as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file && !submissionData.fileUrl) {
      alert('Please select a file or provide a link');
      return;
    }

    if (file && file.size > 800 * 1024) {
      alert('File is too large. Maximum size allowed is 800KB. Please use a smaller file or a link.');
      return;
    }

    const submissionId = `${selectedAssignment.id}_${profile.uid}`;
    const newPending = {
      id: submissionId,
      title: selectedAssignment.title,
      progress: 0,
      status: 'reading' as const
    };

    setIsSubmitModalOpen(false);
    setPendingSubmissions(prev => [...prev, newPending]);

    const processSubmission = async () => {
      try {
        let finalFileUrl = submissionData.fileUrl;

        if (file) {
          finalFileUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                setPendingSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, progress } : s));
              }
            };
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
        }

        setPendingSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'saving' as const, progress: 100 } : s));

        await setDoc(doc(db, 'submissions', submissionId), {
          id: submissionId,
          assignmentId: selectedAssignment.id,
          studentId: profile.uid,
          fileUrl: finalFileUrl,
          submittedAt: Timestamp.now()
        });

        setPendingSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'complete' as const } : s));
        
        setTimeout(() => {
          setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
          fetchData();
        }, 4000);

      } catch (error: any) {
        console.error('Submission Error:', error);
        setPendingSubmissions(prev => prev.map(s => s.id === submissionId ? { 
          ...s, 
          status: 'error' as const, 
          error: error.message?.includes('too large') ? 'File too large' : 'Upload failed'
        } : s));
      }
    };

    processSubmission();
  };

  const handleDeleteAssignment = async (id: string) => {
    if (window.confirm('Delete this assignment?')) {
      await deleteDoc(doc(db, 'assignments', id));
      fetchData();
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Background Submissions Indicator */}
      <div className="fixed bottom-8 right-8 z-[60] space-y-4 pointer-events-none">
        <AnimatePresence>
          {pendingSubmissions.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 pointer-events-auto"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  sub.status === 'complete' ? 'bg-green-100 text-green-600' :
                  sub.status === 'error' ? 'bg-red-100 text-red-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {sub.status === 'complete' ? <CheckCircle2 className="w-6 h-6" /> :
                   sub.status === 'error' ? <AlertCircle className="w-6 h-6" /> :
                   <Loader2 className="w-6 h-6 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-900 text-sm truncate">{sub.title}</h4>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {sub.status === 'complete' ? 'Submission Successful' :
                     sub.status === 'error' ? (sub.error || 'Submission Failed') :
                     sub.status === 'reading' ? `Reading File (${sub.progress}%)` :
                     'Saving Submission...'}
                  </p>
                </div>
              </div>
              {(sub.status === 'reading' || sub.status === 'saving') && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: sub.status === 'reading' ? `${sub.progress}%` : "100%" }}
                    transition={{ duration: sub.status === 'saving' ? 2 : 0.2 }}
                    className="h-full bg-blue-600"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Assignments & Quizzes</h1>
          <p className="text-gray-500 font-medium">
            {isTeacher ? 'Create and grade student work' : 'View and submit your assignments'}
          </p>
        </div>
        {(isTeacher || isAdmin) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New
          </button>
        )}
      </div>

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {loading ? (
          [1,2].map(i => <div key={i} className="h-64 bg-gray-100 rounded-3xl animate-pulse"></div>)
        ) : assignments.length === 0 ? (
          <div className="lg:col-span-2 py-20 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">
            No assignments or quizzes found.
          </div>
        ) : assignments.map((assignment) => {
          const submission = submissions.find(s => s.assignmentId === assignment.id && s.studentId === profile.uid);
          const isOverdue = assignment.dueDate.toDate() < new Date() && !submission;
          
          return (
            <motion.div 
              key={assignment.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-8 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${assignment.type === 'quiz' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                      assignment.type === 'quiz' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {assignment.type}
                    </span>
                    {submission && (
                      <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-black uppercase tracking-widest">
                        Submitted
                      </span>
                    )}
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-gray-900 mb-2">{assignment.title}</h3>
                <p className="text-gray-500 text-sm font-medium line-clamp-2 mb-6">{assignment.description}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    {courses.find(c => c.id === assignment.courseId)?.name || 'Course'}
                  </div>
                  <div className={`flex items-center gap-2 text-sm font-bold ${isOverdue ? 'text-red-500' : 'text-gray-600'}`}>
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {format(assignment.dueDate.toDate(), 'MMM d, h:mm a')}
                  </div>
                </div>

                {submission && submission.grade && (
                  <div className="mt-6 p-4 bg-green-50 rounded-2xl flex items-center justify-between">
                    <span className="text-sm font-bold text-green-700">Grade Received</span>
                    <span className="text-xl font-black text-green-700">{submission.grade}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50/50 border-t border-gray-50 flex gap-2">
                {isStudent && !submission && !isOverdue && (
                  <button 
                    onClick={() => {
                      setSelectedAssignment(assignment);
                      setIsSubmitModalOpen(true);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Submit Now
                  </button>
                )}
                {isStudent && submission && (
                  <button 
                    onClick={() => setViewingFile({ url: submission.fileUrl, title: assignment.title })}
                    className="flex-1 py-2.5 bg-white border border-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    View Submission
                  </button>
                )}
                {(isTeacher || isAdmin) && (
                  <>
                    <button 
                      className="flex-1 py-2.5 bg-white border border-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Submissions
                    </button>
                    <button 
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      className="p-2.5 bg-white border border-gray-100 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create Assignment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Create New</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveAssignment} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="Midterm Assignment"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 h-24 resize-none"
                    placeholder="Enter details..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Course</label>
                    <select 
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.courseId}
                      onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Type</label>
                    <select 
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="assignment">Assignment</option>
                      <option value="quiz">Quiz</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Due Date & Time</label>
                  <input 
                    required
                    type="datetime-local" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  Create Assignment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Submit Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Submit Work</h2>
                <button onClick={() => setIsSubmitModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmitAssignment} className="p-8 space-y-6">
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-4">
                    Submitting for: <span className="text-gray-900">{selectedAssignment?.title}</span>
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Upload File</label>
                      <div 
                        className="relative group cursor-pointer"
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50'); }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-blue-50'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('bg-blue-50');
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            input.files = dataTransfer.files;
                          }
                        }}
                      >
                        <div className="w-full px-6 py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 group-hover:border-blue-400 transition-all">
                          <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-black text-gray-900">Click to upload or drag and drop</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">PDF or Word Document</p>
                          </div>
                          <input 
                            type="file" 
                            accept=".pdf,.doc,.docx"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-100"></div>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
                        <span className="bg-white px-4 text-gray-400">Or Provide Link</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">File URL</label>
                      <input 
                        type="url" 
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                        placeholder="https://docs.google.com/..."
                        value={submissionData.fileUrl}
                        onChange={(e) => setSubmissionData({ fileUrl: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full py-5 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-xl shadow-green-100">
                  Confirm Submission
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Viewer Modal */}
      <AnimatePresence>
        {viewingFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full max-w-7xl bg-white rounded-[3rem] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 lg:p-8 border-b border-gray-100 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-gray-900 truncate max-w-md">{viewingFile.title}</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission Preview</p>
                </div>
                <div className="flex items-center gap-4">
                  <a 
                    href={viewingFile.url} 
                    download={viewingFile.title}
                    className="hidden sm:flex items-center gap-2 px-6 py-3 bg-gray-50 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    <Upload className="w-4 h-4 rotate-180" />
                    Download
                  </a>
                  <button 
                    onClick={() => setViewingFile(null)}
                    className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all"
                  >
                    <Plus className="w-8 h-8 rotate-45" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-gray-100 relative overflow-hidden">
                {viewingFile.url.startsWith('data:application/pdf') ? (
                  <iframe 
                    src={`${viewingFile.url}#toolbar=0`}
                    className="w-full h-full border-none"
                    title={viewingFile.title}
                  />
                ) : viewingFile.url.startsWith('data:image') ? (
                  <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
                    <img 
                      src={viewingFile.url} 
                      alt={viewingFile.title} 
                      className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center bg-white">
                    <div className="p-8 bg-amber-50 text-amber-600 rounded-[3rem] mb-6">
                      <AlertCircle className="w-20 h-20" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-2">Preview Not Available</h3>
                    <p className="text-gray-500 font-medium mb-8 max-w-md">
                      This file type cannot be previewed directly. Please download it to view.
                    </p>
                    <a 
                      href={viewingFile.url} 
                      download={viewingFile.title}
                      className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-3"
                    >
                      <Upload className="w-5 h-5 rotate-180" />
                      Download to View
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
