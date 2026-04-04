import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, Outlet } from 'react-router-dom';
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, Timestamp, FirebaseUser, onSnapshot, query, collection, where } from './lib/firebase';
import { 
  Library,
  Info,
  Download,
  ExternalLink,
  Users, 
  BookOpen, 
  Calendar, 
  CreditCard, 
  FileText, 
  Upload, 
  Bell, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  GraduationCap,
  ChevronRight,
  BookMarked,
  CheckCircle2,
  Clock,
  AlertCircle,
  BrainCircuit,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Pages (to be implemented)
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import UserManagement from './pages/UserManagement';
import CourseManagement from './pages/CourseManagement';
import Attendance from './pages/Attendance';
import FeeManagement from './pages/FeeManagement';
import Assignments from './pages/Assignments';
import Resources from './pages/Resources';
import Notifications from './pages/Notifications';
import Quizzes from './pages/Quizzes';
import AboutAcademy from './pages/AboutAcademy';

// Types
export type UserRole = 'admin' | 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  photoURL?: string;
  createdAt: Timestamp;
}

// Error Boundary (Simplified)
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        setHasError(true);
        setErrorInfo(event.error.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-2xl font-bold">System Error</h2>
          </div>
          <p className="text-gray-600 mb-6 font-medium">
            A security or database error occurred. Please contact the administrator.
          </p>
          <div className="bg-gray-900 p-4 rounded-lg overflow-auto max-h-48 mb-6">
            <code className="text-xs text-green-400 break-all">
              {errorInfo}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Pending Approval Component
function PendingApproval({ profile }: { profile: UserProfile }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center"
      >
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg ${
          profile.status === 'rejected' ? 'bg-red-100 text-red-600 shadow-red-50' : 'bg-amber-100 text-amber-600 shadow-amber-50'
        }`}>
          {profile.status === 'rejected' ? <ShieldAlert className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
          {profile.status === 'rejected' ? 'Access Denied' : 'Pending Approval'}
        </h1>
        <p className="text-gray-500 mb-8 font-medium leading-relaxed">
          {profile.status === 'rejected' 
            ? 'Your registration request has been rejected by the administrator. Please contact support if you believe this is an error.' 
            : 'Welcome to Acuity Nursing! Your account is currently pending administrator approval. You will gain full access once your registration is verified.'}
        </p>
        
        <button 
          onClick={() => auth.signOut()}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </motion.div>
    </div>
  );
}

// Layout Component
function Layout({ user, profile, pendingCount }: { user: FirebaseUser, profile: UserProfile, pendingCount: number }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: BarChart3, roles: ['admin', 'teacher', 'student'] },
    { name: 'Users', path: '/users', icon: Users, roles: ['admin'] },
    { name: 'Courses', path: '/courses', icon: BookOpen, roles: ['admin'] },
    { name: 'Attendance', path: '/attendance', icon: Calendar, roles: ['admin', 'teacher', 'student'] },
    { name: 'Fees', path: '/fees', icon: CreditCard, roles: ['admin', 'student'] },
    { name: 'Assignments', path: '/assignments', icon: FileText, roles: ['admin', 'teacher', 'student'] },
    { name: 'Quizzes', path: '/quizzes', icon: BrainCircuit, roles: ['admin', 'teacher', 'student'] },
    { name: 'Library', path: '/resources', icon: Library, roles: ['admin', 'teacher', 'student'] },
    { name: 'About Academy', path: '/about', icon: Info, roles: ['admin', 'teacher', 'student'] },
    { name: 'Notifications', path: '/notifications', icon: Bell, roles: ['admin', 'teacher', 'student'] },
  ];

  const getFilteredNav = () => {
    const filtered = navItems.filter(item => item.roles.includes(profile.role));
    
    if (profile.role === 'student') {
      const studentOrder = ['Attendance', 'Quizzes', 'Library', 'About Academy'];
      const prioritized = filtered.filter(item => studentOrder.includes(item.name));
      const others = filtered.filter(item => !studentOrder.includes(item.name));
      
      // Sort prioritized items according to studentOrder
      prioritized.sort((a, b) => studentOrder.indexOf(a.name) - studentOrder.indexOf(b.name));
      
      return [...prioritized, ...others];
    }
    
    return filtered;
  };

  const filteredNav = getFilteredNav();

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && window.innerWidth < 1024 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : 0,
          x: (isSidebarOpen || window.innerWidth >= 1024) ? 0 : -260,
          opacity: (isSidebarOpen || window.innerWidth >= 1024) ? 1 : 0
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed lg:relative bg-white border-r border-gray-200 flex flex-col z-40 h-full shadow-2xl lg:shadow-none ${!isSidebarOpen && 'pointer-events-none lg:pointer-events-auto'}`}
      >
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg text-gray-900 truncate">
              Acuity Nursing
            </span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNav.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${location.pathname === item.path ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <span className="font-medium">{item.name}</span>
              {item.name === 'Users' && pendingCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-amber-200">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
              {filteredNav.find(item => item.path === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
            </div>
            <img 
              src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`} 
              alt={profile.name}
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
              referrerPolicy="no-referrer"
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 w-full max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribePending: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up previous listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribePending) unsubscribePending();
      
      if (user) {
        setUser(user);
        // Use onSnapshot for real-time profile updates (e.g., approval)
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            
            // If admin, listen for pending users
            if (data.role === 'admin') {
              // Clean up previous pending listener if role changed or re-triggered
              if (unsubscribePending) unsubscribePending();
              const q = query(collection(db, 'users'), where('status', '==', 'pending'));
              unsubscribePending = onSnapshot(q, (snapshot) => {
                setPendingCount(snapshot.size);
              });
            } else {
              if (unsubscribePending) unsubscribePending();
              setPendingCount(0);
            }
          } else {
            const isAdminEmail = user.email === "nawazidrees4323@gmail.com";
            const newProfile: UserProfile = {
              uid: user.uid,
              name: user.displayName || 'New User',
              email: user.email || '',
              role: isAdminEmail ? 'admin' : 'student',
              status: isAdminEmail ? 'approved' : 'pending',
              photoURL: user.photoURL || undefined,
              createdAt: Timestamp.now(),
            };
            setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setPendingCount(0);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribePending) unsubscribePending();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA]">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Loading Acuity Nursing LMS...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {!user ? (
            <Route path="*" element={<Login />} />
          ) : profile ? (
            profile.status === 'approved' ? (
              <Route path="/" element={<Layout user={user} profile={profile} pendingCount={pendingCount} />}>
                <Route index element={<DashboardRouter profile={profile} />} />
                <Route path="users" element={profile.role === 'admin' ? <UserManagement /> : <Navigate to="/" />} />
                <Route path="courses" element={profile.role === 'admin' ? <CourseManagement /> : <Navigate to="/" />} />
                <Route path="attendance" element={<Attendance profile={profile} />} />
                <Route path="fees" element={(profile.role === 'admin' || profile.role === 'student') ? <FeeManagement profile={profile} /> : <Navigate to="/" />} />
                <Route path="assignments" element={<Assignments profile={profile} />} />
                <Route path="quizzes" element={<Quizzes profile={profile} />} />
                <Route path="resources" element={<Resources profile={profile} />} />
                <Route path="about" element={<AboutAcademy />} />
                <Route path="notifications" element={<Notifications profile={profile} />} />
              </Route>
            ) : (
              <Route path="*" element={<PendingApproval profile={profile} />} />
            )
          ) : (
            <Route path="*" element={<Navigate to="/" />} />
          )}
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

function DashboardRouter({ profile }: { profile: UserProfile }) {
  switch (profile.role) {
    case 'admin': return <AdminDashboard profile={profile} />;
    case 'teacher': return <TeacherDashboard profile={profile} />;
    case 'student': return <StudentDashboard profile={profile} />;
    default: return <Navigate to="/login" />;
  }
}
