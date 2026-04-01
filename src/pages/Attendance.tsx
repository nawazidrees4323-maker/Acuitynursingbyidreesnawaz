import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, query, where, Timestamp, onSnapshot } from '../lib/firebase';
import { Calendar, CheckCircle2, XCircle, Clock, Search, Filter, User, BookOpen, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  markedBy: 'admin' | 'teacher' | 'student';
  timestamp: any;
}

interface Student { uid: string; name: string; courseId: string; }
interface Course { id: string; name: string; }
interface Subject { id: string; name: string; courseId: string; }

export default function Attendance({ profile }: { profile: any }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [view, setView] = useState<'mark' | 'analytics'>('mark');

  const isTeacher = profile.role === 'teacher';
  const isAdmin = profile.role === 'admin';
  const isStudent = profile.role === 'student';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const subjectsSnap = await getDocs(collection(db, 'subjects'));
        
        setStudents(studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student)));
        setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time attendance listener
    const attendanceQuery = isStudent 
      ? query(collection(db, 'attendance'), where('studentId', '==', profile.uid))
      : collection(db, 'attendance');

    const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    });

    return () => unsubscribe();
  }, [profile.uid, isStudent]);

  const handleMarkAttendance = async (studentId: string, studentName: string, status: 'present' | 'absent' | 'late') => {
    if (!selectedCourse || !selectedSubject) {
      alert('Please select a course and subject first.');
      return;
    }

    const id = `${studentId}_${selectedSubject}_${selectedDate}`;
    try {
      await setDoc(doc(db, 'attendance', id), {
        id,
        studentId,
        studentName,
        courseId: selectedCourse,
        subjectId: selectedSubject,
        date: selectedDate,
        status,
        markedBy: profile.role,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const handleStudentCheckIn = async () => {
    if (!selectedCourse || !selectedSubject) {
      alert('Please select your current course and subject.');
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const id = `${profile.uid}_${selectedSubject}_${today}`;
    
    try {
      await setDoc(doc(db, 'attendance', id), {
        id,
        studentId: profile.uid,
        studentName: profile.name,
        courseId: selectedCourse,
        subjectId: selectedSubject,
        date: today,
        status: 'present',
        markedBy: 'student',
        timestamp: Timestamp.now()
      });
      alert('Attendance marked successfully!');
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const filteredAttendance = attendance.filter(a => {
    const matchesCourse = !selectedCourse || a.courseId === selectedCourse;
    const matchesSubject = !selectedSubject || a.subjectId === selectedSubject;
    const matchesDate = !selectedDate || a.date === selectedDate;
    return matchesCourse && matchesSubject && matchesDate;
  });

  const getAttendanceStats = (studentId?: string) => {
    const records = studentId 
      ? attendance.filter(a => a.studentId === studentId)
      : attendance;
    
    const total = records.length;
    if (total === 0) return { percentage: 0, present: 0, absent: 0, late: 0 };
    
    const present = records.filter(a => a.status === 'present').length;
    const absent = records.filter(a => a.status === 'absent').length;
    const late = records.filter(a => a.status === 'late').length;
    
    return {
      total,
      present,
      absent,
      late,
      percentage: Math.round(((present + late * 0.5) / total) * 100)
    };
  };

  const stats = isStudent ? getAttendanceStats(profile.uid) : getAttendanceStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700 border-green-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'late': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-400 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Attendance System</h1>
          <p className="text-gray-500 font-medium">Track and manage daily attendance records</p>
        </div>
        
        <div className="flex p-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <button 
            onClick={() => setView('mark')}
            className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'mark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            Records
          </button>
          <button 
            onClick={() => setView('analytics')}
            className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'analytics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Attendance Rate</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{stats.percentage}%</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Present</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{stats.present}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Absent</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{stats.absent}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Late</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{stats.late}</p>
        </div>
      </div>

      {view === 'mark' ? (
        <div className="space-y-8">
          {/* Controls */}
          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Course</label>
              <select 
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  setSelectedSubject('');
                }}
              >
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Subject</label>
              <select 
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">Select Subject</option>
                {subjects.filter(s => !selectedCourse || s.courseId === selectedCourse).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="date" 
                  className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isStudent && (
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[3rem] text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row items-center justify-between gap-8"
            >
              <div className="text-center md:text-left">
                <h3 className="text-3xl font-black mb-2">Daily Check-in</h3>
                <p className="text-blue-100 font-medium">Mark your attendance for today's session instantly.</p>
              </div>
              <button 
                onClick={handleStudentCheckIn}
                className="px-12 py-5 bg-white text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 transition-all shadow-lg"
              >
                Mark Present Now
              </button>
            </motion.div>
          )}

          {/* Table */}
          <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">Attendance Records</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <Clock className="w-4 h-4" />
                Last updated: {format(new Date(), 'hh:mm a')}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    {(isTeacher || isAdmin) && <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [1,2,3,4,5].map(i => <tr key={i} className="h-24 animate-pulse bg-gray-50/20"></tr>)
                  ) : (isTeacher || isAdmin) ? (
                    students.map((student) => {
                      const record = filteredAttendance.find(a => a.studentId === student.uid);
                      return (
                        <tr key={student.uid} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg shadow-sm">
                                {student.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-gray-900">{student.name}</p>
                                <p className="text-xs text-gray-400 font-bold">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-bold text-gray-600">
                              {subjects.find(s => s.id === selectedSubject)?.name || 'Select Subject'}
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            {record ? (
                              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${getStatusColor(record.status)}`}>
                                {record.status === 'present' && <CheckCircle2 className="w-3 h-3" />}
                                {record.status === 'absent' && <XCircle className="w-3 h-3" />}
                                {record.status === 'late' && <Clock className="w-3 h-3" />}
                                {record.status}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Not Marked</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleMarkAttendance(student.uid, student.name, 'present')}
                                className={`p-3 rounded-xl transition-all ${record?.status === 'present' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleMarkAttendance(student.uid, student.name, 'absent')}
                                className={`p-3 rounded-xl transition-all ${record?.status === 'absent' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleMarkAttendance(student.uid, student.name, 'late')}
                                className={`p-3 rounded-xl transition-all ${record?.status === 'late' ? 'bg-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-600'}`}
                              >
                                <Clock className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    attendance.filter(a => a.studentId === profile.uid).map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="font-black text-gray-900">{record.date}</p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-gray-600">
                            {subjects.find(s => s.id === record.subjectId)?.name || 'N/A'}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${getStatusColor(record.status)}`}>
                            {record.status}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
            <h3 className="text-2xl font-black text-gray-900 mb-8">Attendance Distribution</h3>
            <div className="space-y-6">
              {[
                { label: 'Present', value: stats.present, color: 'bg-green-500', percentage: Math.round((stats.present / stats.total) * 100) || 0 },
                { label: 'Absent', value: stats.absent, color: 'bg-red-500', percentage: Math.round((stats.absent / stats.total) * 100) || 0 },
                { label: 'Late', value: stats.late, color: 'bg-amber-500', percentage: Math.round((stats.late / stats.total) * 100) || 0 }
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold text-gray-600">{item.label}</span>
                    <span className="text-sm font-black text-gray-900">{item.percentage}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      className={`h-full ${item.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
            <h3 className="text-2xl font-black text-gray-900 mb-8">Subject-wise Analysis</h3>
            <div className="space-y-4">
              {subjects.map(subject => {
                const subjectRecords = attendance.filter(a => a.subjectId === subject.id);
                const present = subjectRecords.filter(a => a.status === 'present').length;
                const total = subjectRecords.length;
                const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

                return (
                  <div key={subject.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="font-bold text-gray-700">{subject.name}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-black ${percentage >= 75 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
