import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, query, where } from '../lib/firebase';
import { BookOpen, Plus, Search, Edit2, Trash2, BookCopy, GraduationCap, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Course {
  id: string;
  name: string;
  description: string;
  semester: number;
  teacherId?: string;
}

interface Subject {
  id: string;
  name: string;
  courseId: string;
  semester: number;
}

interface Teacher {
  uid: string;
  name: string;
}

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    semester: 1,
    teacherId: ''
  });

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    courseId: '',
    semester: 1
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const teachersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));

      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      setTeachers(teachersSnap.docs.map(doc => ({ uid: doc.id, name: doc.data().name } as Teacher)));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = editingCourse ? editingCourse.id : Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'courses', id), courseForm, { merge: true });
      setIsCourseModalOpen(false);
      setEditingCourse(null);
      setCourseForm({ name: '', description: '', semester: 1, teacherId: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving course:', error);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'subjects', id), subjectForm);
      setIsSubjectModalOpen(false);
      setSubjectForm({ name: '', courseId: '', semester: 1 });
      fetchData();
    } catch (error) {
      console.error('Error saving subject:', error);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (window.confirm('Delete course and all its subjects?')) {
      await deleteDoc(doc(db, 'courses', id));
      fetchData();
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Course Management</h1>
          <p className="text-gray-500 font-medium">Manage nursing programs, semesters, and subjects</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsSubjectModalOpen(true)}
            className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Subject
          </button>
          <button 
            onClick={() => {
              setEditingCourse(null);
              setCourseForm({ name: '', description: '', semester: 1, teacherId: '' });
              setIsCourseModalOpen(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            Add Course
          </button>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-3xl animate-pulse"></div>)
        ) : courses.map((course) => (
          <motion.div 
            key={course.id}
            whileHover={{ y: -5 }}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="p-8 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-black uppercase tracking-widest">
                  Semester {course.semester}
                </span>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">{course.name}</h3>
              <p className="text-gray-500 text-sm font-medium line-clamp-2 mb-6">{course.description}</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  {teachers.find(t => t.uid === course.teacherId)?.name || 'No teacher assigned'}
                </div>
                <div className="pt-4 border-t border-gray-50">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Subjects</p>
                  <div className="flex flex-wrap gap-2">
                    {subjects.filter(s => s.courseId === course.id).map(subject => (
                      <span key={subject.id} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                        {subject.name}
                      </span>
                    ))}
                    {subjects.filter(s => s.courseId === course.id).length === 0 && (
                      <span className="text-xs text-gray-400 italic">No subjects added</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50/50 border-t border-gray-50 flex gap-2">
              <button 
                onClick={() => {
                  setEditingCourse(course);
                  setCourseForm({
                    name: course.name,
                    description: course.description,
                    semester: course.semester,
                    teacherId: course.teacherId || ''
                  });
                  setIsCourseModalOpen(true);
                }}
                className="flex-1 py-2 bg-white border border-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button 
                onClick={() => handleDeleteCourse(course.id)}
                className="flex-1 py-2 bg-white border border-gray-100 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Course Modal */}
      <AnimatePresence>
        {isCourseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">{editingCourse ? 'Edit Course' : 'Add Course'}</h2>
                <button onClick={() => setIsCourseModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveCourse} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Course Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm({...courseForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 h-24 resize-none"
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Semester</label>
                    <input 
                      required
                      type="number" 
                      min="1" max="10"
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={courseForm.semester}
                      onChange={(e) => setCourseForm({...courseForm, semester: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Assign Teacher</label>
                    <select 
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={courseForm.teacherId}
                      onChange={(e) => setCourseForm({...courseForm, teacherId: e.target.value})}
                    >
                      <option value="">Select Teacher</option>
                      {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all">
                  Save Course
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subject Modal */}
      <AnimatePresence>
        {isSubjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Add Subject</h2>
                <button onClick={() => setIsSubjectModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveSubject} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Subject Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Course</label>
                  <select 
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={subjectForm.courseId}
                    onChange={(e) => setSubjectForm({...subjectForm, courseId: e.target.value})}
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Semester</label>
                  <input 
                    required
                    type="number" 
                    min="1" max="10"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={subjectForm.semester}
                    onChange={(e) => setSubjectForm({...subjectForm, semester: parseInt(e.target.value)})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all">
                  Save Subject
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
