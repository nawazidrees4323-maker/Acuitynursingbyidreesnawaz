import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, where, Timestamp } from '../lib/firebase';
import { BookOpen, Users, Calendar, FileText, TrendingUp, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import ProfileSection from '../components/ProfileSection';

export default function TeacherDashboard({ profile }: { profile: any }) {
  const [assignedCourses, setAssignedCourses] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
    avgAttendance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const coursesSnap = await getDocs(query(collection(db, 'courses'), where('teacherId', '==', profile.uid)));
        const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAssignedCourses(courses);

        const assignmentsSnap = await getDocs(collection(db, 'assignments'));
        const submissionsSnap = await getDocs(collection(db, 'submissions'));
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const attendanceSnap = await getDocs(collection(db, 'attendance'));

        const myAssignments = assignmentsSnap.docs.filter(doc => courses.some(c => c.id === doc.data().courseId));
        const mySubmissions = submissionsSnap.docs.filter(doc => myAssignments.some(a => a.id === doc.data().assignmentId));
        const myAttendance = attendanceSnap.docs.filter(doc => courses.some(c => c.id === doc.data().courseId));

        const presentCount = myAttendance.filter(a => a.data().status === 'present').length;
        const avgAttendance = myAttendance.length > 0 ? (presentCount / myAttendance.length) * 100 : 0;

        setStats({
          totalStudents: usersSnap.size,
          totalAssignments: myAssignments.length,
          pendingSubmissions: myAssignments.length * usersSnap.size - mySubmissions.length,
          avgAttendance: Math.round(avgAttendance)
        });
      } catch (error) {
        console.error('Error fetching teacher data:', error);
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
      <ProfileSection profile={profile} />
      
      <div>
        <h1 className="text-3xl font-black text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-500 font-medium">Welcome back, {profile.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value={stats.totalStudents} icon={Users} color="blue" />
        <StatCard title="Assignments" value={stats.totalAssignments} icon={FileText} color="green" />
        <StatCard title="Pending Review" value={stats.pendingSubmissions} icon={AlertCircle} color="amber" />
        <StatCard title="Avg Attendance" value={`${stats.avgAttendance}%`} icon={Calendar} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Assigned Courses */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Assigned Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignedCourses.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">
                No courses assigned to you yet.
              </div>
            ) : assignedCourses.map((course) => (
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
                    <Users className="w-4 h-4" />
                    {stats.totalStudents} Students
                  </div>
                  <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline">
                    View Details
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-6">
            <ActivityItem 
              icon={CheckCircle2} 
              color="green" 
              title="Attendance Marked" 
              desc="Semester 2 - Anatomy" 
              time="2 hours ago" 
            />
            <ActivityItem 
              icon={FileText} 
              color="blue" 
              title="New Assignment" 
              desc="Nursing Ethics Quiz" 
              time="5 hours ago" 
            />
            <ActivityItem 
              icon={AlertCircle} 
              color="amber" 
              title="Submission Pending" 
              desc="15 students yet to submit" 
              time="1 day ago" 
            />
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

function ActivityItem({ icon: Icon, color, title, desc, time }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600'
  };

  return (
    <div className="flex gap-4">
      <div className={`p-2.5 rounded-xl shrink-0 h-fit ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-500 font-medium mb-1">{desc}</p>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{time}</span>
      </div>
    </div>
  );
}
