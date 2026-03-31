import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, where, Timestamp } from '../lib/firebase';
import { BookOpen, Calendar, FileText, CreditCard, CheckCircle2, Clock, AlertCircle, TrendingUp, BookMarked } from 'lucide-react';
import { motion } from 'motion/react';

export default function StudentDashboard({ profile }: { profile: any }) {
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [stats, setStats] = useState({
    attendance: 0,
    assignmentsDone: 0,
    pendingFees: 0,
    avgGrade: 'A'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEnrolledCourses(courses);

        const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', profile.uid)));
        const submissionsSnap = await getDocs(query(collection(db, 'submissions'), where('studentId', '==', profile.uid)));
        const feesSnap = await getDocs(query(collection(db, 'fees'), where('studentId', '==', profile.uid)));

        const presentCount = attendanceSnap.docs.filter(doc => doc.data().status === 'present').length;
        const avgAttendance = attendanceSnap.size > 0 ? (presentCount / attendanceSnap.size) * 100 : 0;
        
        const pendingFees = feesSnap.docs.filter(doc => doc.data().status === 'pending').reduce((acc, curr) => acc + curr.data().amount, 0);

        setStats({
          attendance: Math.round(avgAttendance),
          assignmentsDone: submissionsSnap.size,
          pendingFees,
          avgGrade: 'A' // Placeholder
        });
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile.uid]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
      </div>
      <div className="h-96 bg-gray-200 rounded-2xl"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Student Dashboard</h1>
        <p className="text-gray-500 font-medium">Welcome back, {profile.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Attendance" value={`${stats.attendance}%`} icon={Calendar} color="blue" />
        <StatCard title="Assignments" value={stats.assignmentsDone} icon={FileText} color="green" />
        <StatCard title="Pending Fees" value={`PKR ${stats.pendingFees.toLocaleString()}`} icon={CreditCard} color="amber" />
        <StatCard title="Avg Grade" value={stats.avgGrade} icon={TrendingUp} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Enrolled Courses */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            My Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enrolledCourses.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">
                You are not enrolled in any courses yet.
              </div>
            ) : enrolledCourses.map((course) => (
              <motion.div 
                key={course.id}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-widest">
                    Semester {course.semester}
                  </span>
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-2">{course.name}</h3>
                <p className="text-sm text-gray-500 font-medium line-clamp-2 mb-6">{course.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                    <BookMarked className="w-4 h-4" />
                    Nursing Program
                  </div>
                  <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline">
                    View Course
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Progress Summary */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Course Progress</h2>
          <div className="space-y-8">
            <ProgressItem title="Anatomy & Physiology" progress={85} color="blue" />
            <ProgressItem title="Nursing Ethics" progress={92} color="green" />
            <ProgressItem title="Pharmacology" progress={65} color="amber" />
            <ProgressItem title="Microbiology" progress={78} color="purple" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className={`p-3 rounded-2xl w-fit mb-4 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-black text-gray-900">{value}</h3>
    </div>
  );
}

function ProgressItem({ title, progress, color }: any) {
  const colors: any = {
    blue: 'bg-blue-600 shadow-blue-100',
    green: 'bg-green-600 shadow-green-100',
    amber: 'bg-amber-600 shadow-amber-100',
    purple: 'bg-purple-600 shadow-purple-100'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <span className="text-sm font-black text-gray-900">{progress}%</span>
      </div>
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full shadow-lg ${colors[color]}`}
        />
      </div>
    </div>
  );
}
