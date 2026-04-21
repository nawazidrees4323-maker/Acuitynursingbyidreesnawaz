import { useState, useEffect, useRef } from 'react';
import { db, collection, getDocs, query, where, limit, orderBy, Timestamp } from '../lib/firebase';
import { Users, BookOpen, Calendar, CreditCard, TrendingUp, UserCheck, UserPlus, BookCopy, ChevronRight, RotateCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import ProfileSection from '../components/ProfileSection';

export default function AdminDashboard({ profile }: { profile: any }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    activeAssignments: 0,
    totalRevenue: 0,
    avgAttendance: 0
  });

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Use a ref to prevent re-fetching on every re-render unless explicitly needed
  const initialized = useRef(false);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch Users Summary (Only first 100 for stats/pending)
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(100)));
      const usersData = usersSnap.docs.map(doc => doc.data());
      
      const students = usersData.filter(u => u.role === 'student' || u.role === 'Student');
      const teachers = usersData.filter(u => u.role === 'teacher' || u.role === 'Teacher');
      const pending = usersData.filter(u => u.status === 'pending');

      // 2. Fetch Courses Count
      const coursesSnap = await getDocs(query(collection(db, 'courses'), limit(50)));
      
      // 3. Fetch Fees (Recent 50 only for revenue calculation)
      const feesSnap = await getDocs(query(collection(db, 'fees'), limit(50)));
      const revenue = feesSnap.docs
        .map(doc => doc.data())
        .filter(f => f.status === 'paid')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);

      // 4. Fetch Attendance (Recent 50)
      const attendanceSnap = await getDocs(query(collection(db, 'attendance'), limit(50)));
      const attendance = attendanceSnap.docs.map(doc => doc.data());
      const presentCount = attendance.filter(a => a.status === 'present').length;
      const avgAtt = attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;

      setStats({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalCourses: coursesSnap.size,
        activeAssignments: 0, // Placeholder
        totalRevenue: revenue,
        avgAttendance: Math.round(avgAtt)
      });
      setPendingUsers(pending);
    } catch (error) {
      console.error("Dashboard optimization error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialized.current) {
      fetchDashboardData();
      initialized.current = true;
    }
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
      
      {pendingUsers.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-center justify-between gap-6 shadow-xl shadow-amber-100/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
              <UserPlus className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-900">Pending Approvals</h3>
              <p className="text-amber-700 font-medium">There are {pendingUsers.length} new users waiting for your approval.</p>
            </div>
          </div>
          <Link 
            to="/users"
            className="px-8 py-3 bg-amber-600 text-white rounded-2xl font-black hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center gap-2 whitespace-nowrap"
          >
            Review Requests
            <ChevronRight className="w-5 h-5" />
          </Link>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 font-medium">Welcome back, {profile.name}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/users')}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
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
