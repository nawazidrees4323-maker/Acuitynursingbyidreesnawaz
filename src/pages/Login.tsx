import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, db, doc, getDoc, setDoc, Timestamp, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, collection, query, where, getDocs } from '../lib/firebase';
import { GraduationCap, LogIn, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        const isAdminEmail = user.email === "nawazidrees4323@gmail.com";
        await setDoc(docRef, {
          uid: user.uid,
          name: user.displayName || 'New User',
          email: user.email || '',
          role: isAdminEmail ? 'admin' : 'student',
          status: isAdminEmail ? 'approved' : 'pending',
          photoURL: user.photoURL || undefined,
          createdAt: Timestamp.now(),
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        
        const isAdminEmail = email === "nawazidrees4323@gmail.com";
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          name,
          email,
          role: isAdminEmail ? 'admin' : 'student',
          status: isAdminEmail ? 'approved' : 'pending',
          createdAt: Timestamp.now(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-100">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Acuity Nursing</h1>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-widest mt-1">LMS Portal</p>
        </div>

        <div className="flex bg-gray-50 p-1 rounded-2xl mb-8">
          <button 
            onClick={() => setIsRegistering(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${!isRegistering ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Login
          </button>
          <button 
            onClick={() => setIsRegistering(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${isRegistering ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <AnimatePresence mode="wait">
            {isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Full Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
            />
          </div>

          {!isRegistering && (
            <div className="flex justify-end">
              <button 
                type="button"
                onClick={async () => {
                  if (!email) {
                    alert('Please enter your email first');
                    return;
                  }
                  try {
                    // Find user by email and mark for reset
                    const q = query(collection(db, 'users'), where('email', '==', email));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                      alert('User not found');
                      return;
                    }
                    const userDoc = snap.docs[0];
                    await setDoc(doc(db, 'users', userDoc.id), { resetRequested: true }, { merge: true });
                    alert('Password reset request sent to Admin. Please contact your administrator.');
                  } catch (err) {
                    console.error(err);
                    alert('Error sending request');
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
              {error}
            </p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isRegistering ? 'Create Account' : 'Sign In'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-gray-400 font-bold tracking-widest">Or continue with</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 hover:border-blue-100 transition-all shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google Account
        </button>

        <p className="text-[10px] text-gray-400 font-medium text-center mt-8 uppercase tracking-widest leading-relaxed">
          Authorized Access Only • Acuity Nursing LMS
        </p>
      </motion.div>
    </div>
  );
}
