// Forced update for navigation
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
import QuizSchedule from './pages/QuizSchedule';
import VoucherDetail from './pages/VoucherDetail';
import AboutAcademy from './pages/AboutAcademy';

// Types
import { UserRole, UserProfile } from './types';

// Universal Error Boundary to catch all crashes
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
      setErrorDetails(event.error?.message || 'Unknown error');
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-xl w-full bg-white p-12 rounded-[3rem] shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-50">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">System Restart Required</h1>
          <p className="text-gray-500 mb-8 font-medium">A temporary glitch occurred. Please reload to restore your session.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
          >
            Reload Application
          </button>
          <div className="mt-8 pt-8 border-t border-gray-100 text-left">
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2">Technical Details</p>
            <div className="bg-gray-50 p-4 rounded-xl text-[10px] font-mono text-gray-500 overflow-auto max-h-24">
              {errorDetails}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Pending Approval Component
function PendingApproval({ profile }: { profile: UserProfile }) {
  const [feeConfig, setFeeConfig] = useState<{ accountDetails: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'fee_config'));
      if (docSnap.exists()) {
        setFeeConfig(docSnap.data() as any);
      }
    };
    fetchConfig();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center"
      >
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg ${
          profile.status === 'rejected' ? 'bg-red-100 text-red-600 shadow-red-50' : 'bg-amber-100 text-amber-600 shadow-amber-50'
        }`}>
          {profile.status === 'rejected' ? <ShieldAlert className="w-10 h-10" /> : <CreditCard className="w-10 h-10" />}
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
          {profile.status === 'rejected' ? 'Access Denied' : 'Account Blocked / Pending Approval'}
        </h1>
        <p className="text-gray-500 mb-8 font-medium leading-relaxed">
          {profile.status === 'rejected' 
            ? 'Your registration request has been rejected by the administrator. Please contact support if you believe this is an error.' 
            : 'Apka account filhal Pending status par hai. Fee jama na hone ki wajah se ya verification ki wajah se access rok di gayi hai. Baraye meherbani fee pay karein aur uski screenshot admin ke sath share karein taake apka account login continue rahay.'}
        </p>

        {profile.status === 'pending' && feeConfig && (
          <div className="mb-8 text-left bg-blue-50 p-6 rounded-3xl border border-blue-100">
            <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Fee Account Details
            </h3>
            <pre className="whitespace-pre-wrap font-mono text-sm font-bold text-blue-900 bg-white/50 p-4 rounded-xl border border-blue-200">
              {feeConfig.accountDetails}
            </pre>
            <p className="mt-4 text-xs text-blue-600 font-medium">
              After payment, please send your receipt to the administration. Your account will be approved once the payment is verified.
            </p>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-50 transition-all"
          >
            Check Status
          </button>
          <button 
            onClick={() => auth.signOut()}
            className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
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
    { name: 'Quiz Schedule', path: '/quiz-schedule', icon: Calendar, roles: ['admin', 'teacher', 'student'] },
    { name: 'Library', path: '/resources', icon: Library, roles: ['admin', 'teacher', 'student'] },
    { name: 'Vouchers', path: '/vouchers', icon: CreditCard, roles: ['admin', 'student'] },
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
  console.log("App component rendering...");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribePending: (() => void) | undefined;

    // Fallback timeout to stop loading if Firebase hangs
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth setup timed out after 15s");
        setProfileError("Authentication timeout: Profile could not be fetched within 15 seconds.");
        setLoading(false);
      }
    }, 15000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribePending) unsubscribePending();
      
      if (user) {
        setUser(user);
        
        const fetchProfile = async (retryCount = 0) => {
          try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setProfile(data);
              
              if (data.role === 'admin') {
                const q = query(collection(db, 'users'), where('status', '==', 'pending'));
                unsubscribePending = onSnapshot(q, (snapshot) => {
                  setPendingCount(snapshot.size);
                });
              }
            } else {
              // Create profile if it doesn't exist
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
              await setDoc(docRef, newProfile);
              setProfile(newProfile);
            }
            
            // Set up real-time listener
            unsubscribeProfile = onSnapshot(docRef, (snap) => {
              if (snap.exists()) {
                setProfile(snap.data() as UserProfile);
              }
            });

            setProfileError(null);
            setLoading(false);
            clearTimeout(timeout);
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`Auth setup error (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < 2) {
              setTimeout(() => fetchProfile(retryCount + 1), 2000);
            } else {
              setProfileError(errMsg);
              setLoading(false);
              clearTimeout(timeout);
            }
          }
        };

        fetchProfile();
      } else {
        setUser(null);
        setProfile(null);
        setProfileError(null);
        setPendingCount(0);
        setLoading(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribePending) unsubscribePending();
      clearTimeout(timeout);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-6">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-gray-900 font-black text-xl mb-2 tracking-tight">Acuity Nursing LMS</p>
        <p className="text-gray-500 font-medium animate-pulse mb-8">Initializing secure session...</p>
        
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
        >
          Taking too long? Reload
        </button>
      </div>
    );
  }

  // Handle case where user is logged in but profile couldn't be loaded/created
  if (user && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-red-100">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Profile Connection Error</h1>
        <p className="text-gray-500 mb-4 font-medium max-w-md mx-auto">
          We're having trouble connecting to your profile. This usually happens due to a temporary network glitch or slow internet connection.
        </p>
        
        {profileError && (
          <div className="mb-8 p-4 bg-white/50 border border-red-100 rounded-2xl text-[10px] font-mono text-red-400 max-w-md mx-auto overflow-auto">
            <p className="font-bold uppercase tracking-widest mb-1 opacity-50">Error Log</p>
            {profileError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Clock className="w-5 h-5" />
            Retry Connection
          </button>
          <button 
            onClick={() => auth.signOut()}
            className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-50 transition-all"
          >
            Sign Out & Login Again
          </button>
        </div>
        <p className="mt-8 text-xs text-gray-400 font-medium">
          User ID: {user.uid}
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {!user ? (
            <Route path="*" element={<Login />} />
          ) : (
            profile && (profile.status === 'approved' || profile.email === "nawazidrees4323@gmail.com") ? (
              <Route path="/" element={<Layout user={user} profile={profile} pendingCount={pendingCount} />}>
                <Route index element={<DashboardRouter profile={profile} />} />
                <Route path="users" element={profile.role === 'admin' ? <UserManagement /> : <Navigate to="/" />} />
                <Route path="courses" element={profile.role === 'admin' ? <CourseManagement /> : <Navigate to="/" />} />
                <Route path="attendance" element={<Attendance profile={profile} />} />
                <Route path="fees" element={(profile.role === 'admin' || profile.role === 'student') ? <FeeManagement profile={profile} /> : <Navigate to="/" />} />
                <Route path="assignments" element={<Assignments profile={profile} />} />
                <Route path="quizzes" element={<Quizzes profile={profile} />} />
                <Route path="quiz-schedule" element={<QuizSchedule profile={profile} />} />
                <Route path="resources" element={<Resources profile={profile} />} />
                <Route path="vouchers" element={<VoucherDetail profile={profile} />} />
                <Route path="about" element={<AboutAcademy />} />
                <Route path="notifications" element={<Notifications profile={profile} />} />
              </Route>
            ) : profile ? (
              <Route path="*" element={<PendingApproval profile={profile} />} />
            ) : null
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
