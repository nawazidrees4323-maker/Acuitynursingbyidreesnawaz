import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, query, where, Timestamp } from '../lib/firebase';
import { Calendar, CheckCircle2, XCircle, Clock, Search, Filter, User, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

interface Student {
  uid: string;
  name: string;
  email: string;
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

export default function Attendance({ profile }: { profile: any }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isTeacher = profile.role === 'teacher';
  const isAdmin = profile.role === 'admin';
  const isStudent = profile.role === 'student';

  const fetchData = async () => {
    setLoading(true);
    try {
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const attendanceSnap = await getDocs(collection(db, 'attendance'));

      setStudents(studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student)));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      setAttendance(attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    if (!selectedCourse || !selectedSubject) {
      alert('Please select a course and subject first.');
      return;
    }

    const id = `${studentId}_${selectedSubject}_${selectedDate}`;
    try {
      await setDoc(doc(db, 'attendance', id), {
        id,
        studentId,
        courseId: selectedCourse,
        subjectId: selectedSubject,
        date: selectedDate,
        status
      });
      fetchData();
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const filteredAttendance = attendance.filter(a => {
    const matchesCourse = !selectedCourse || a.courseId === selectedCourse;
    const matchesSubject = !selectedSubject || a.subjectId === selectedSubject;
    const matchesDate = !selectedDate || a.date === selectedDate;
    const matchesStudent = !isStudent || a.studentId === profile.uid;
    return matchesCourse && matchesSubject && matchesDate && matchesStudent;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-600';
      case 'absent': return 'bg-red-50 text-red-600';
      case 'late': return 'bg-amber-50 text-amber-600';
      default: return 'bg-gray-50 text-gray-400';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Attendance</h1>
          <p className="text-gray-500 font-medium">
            {isTeacher ? 'Mark and manage student attendance' : 'View attendance records'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-blue-600 ml-2" />
          <input 
            type="date" 
            className="border-none bg-transparent font-bold text-gray-900 focus:ring-0"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Course</label>
          <select 
            className="w-full px-5 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedSubject('');
            }}
          >
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Subject</label>
          <select 
            className="w-full px-5 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects.filter(s => !selectedCourse || s.courseId === selectedCourse).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Subject</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                {isTeacher && <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Mark Attendance</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1,2,3,4,5].map(i => <tr key={i} className="h-20 animate-pulse bg-gray-50/20"></tr>)
              ) : (isTeacher || isAdmin) ? (
                students.map((student) => {
                  const record = filteredAttendance.find(a => a.studentId === student.uid);
                  return (
                    <tr key={student.uid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-400 font-medium">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-gray-600">
                          {subjects.find(s => s.id === selectedSubject)?.name || 'N/A'}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        {record ? (
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${getStatusColor(record.status)}`}>
                            {record.status}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Not Marked</span>
                        )}
                      </td>
                      {isTeacher && (
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleMarkAttendance(student.uid, 'present')}
                              className={`p-2 rounded-xl transition-all ${record?.status === 'present' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleMarkAttendance(student.uid, 'absent')}
                              className={`p-2 rounded-xl transition-all ${record?.status === 'absent' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleMarkAttendance(student.uid, 'late')}
                              className={`p-2 rounded-xl transition-all ${record?.status === 'late' ? 'bg-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-600'}`}
                            >
                              <Clock className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                filteredAttendance.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <p className="font-bold text-gray-900">{profile.name}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-gray-600">
                        {subjects.find(s => s.id === record.subjectId)?.name || 'N/A'}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
