import { useState, useEffect } from 'react';
import { db, collection, getDocs, query, where, Timestamp } from '../lib/firebase';
import { Users, BookOpen, Calendar, CreditCard, TrendingUp, UserCheck, UserPlus, BookCopy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { motion } from 'motion/react';
import ProfileSection from '../components/ProfileSection';

export default function AdminDashboard({ profile }: { profile: any }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    activeAssignments: 0,
    totalRevenue: 0,
    avgAttendance: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const feesSnap = await getDocs(collection(db, 'fees'));
        const attendanceSnap = await getDocs(collection(db, 'attendance'));

        const users = usersSnap.docs.map(doc => doc.data());
        const fees = feesSnap.docs.map(doc => doc.data());
        const attendance = attendanceSnap.docs.map(doc => doc.data());

        const students = users.filter(u => u.role === 'student');
        const teachers = users.filter(u => u.role === 'teacher');
        
        const revenue = fees.filter(f => f.status === 'paid').reduce((acc, curr) => acc + (curr.amount || 0), 0);
        
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const avgAttendance = attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;

        setStats({
          totalStudents: students.length,
          totalTeachers: teachers.length,
          totalCourses: coursesSnap.size,
          activeAssignments: 0, // Placeholder
          totalRevenue: revenue,
          avgAttendance: Math.round(avgAttendance)
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const data = [
    { name: 'Students', value: stats.totalStudents, color: '#3B82F6' },
    { name: 'Teachers', value: stats.totalTeachers, color: '#10B981' },
    { name: 'Courses', value: stats.totalCourses, color: '#F59E0B' },
  ];

  const attendanceData = [
    { name: 'Mon', value: 85 },
    { name: 'Tue', value: 92 },
    { name: 'Wed', value: 88 },
    { name: 'Thu', value: 95 },
    { name: 'Fri', value: 80 },
  ];

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
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 font-medium">Welcome back, Idrees Nawaz</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add Student
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Students" 
          value={stats.totalStudents} 
          icon={Users} 
          color="blue" 
          trend="+12% this month"
        />
        <StatCard 
          title="Total Teachers" 
          value={stats.totalTeachers} 
          icon={UserCheck} 
          color="green" 
          trend="+2 new"
        />
        <StatCard 
          title="Total Revenue" 
          value={`PKR ${stats.totalRevenue.toLocaleString()}`} 
          icon={CreditCard} 
          color="amber" 
          trend="85% target"
        />
        <StatCard 
          title="Avg Attendance" 
          value={`${stats.avgAttendance}%`} 
          icon={Calendar} 
          color="purple" 
          trend="Stable"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-gray-900">Weekly Attendance %</h2>
            <select className="bg-gray-50 border-none rounded-lg text-sm font-medium px-3 py-1.5 focus:ring-2 focus:ring-blue-100">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-8">User Distribution</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 mt-6">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-medium text-gray-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100',
    green: 'bg-green-50 text-green-600 shadow-green-100',
    amber: 'bg-amber-50 text-amber-600 shadow-amber-100',
    purple: 'bg-purple-50 text-purple-600 shadow-purple-100'
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
          {trend}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-black text-gray-900">{value}</h3>
      </div>
    </motion.div>
  );
}
