import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, query, where, Timestamp } from '../lib/firebase';
import { CreditCard, CheckCircle2, AlertCircle, Search, Filter, Plus, DollarSign, Calendar, Settings, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface FeeConfig {
  accountDetails: string;
  lastUpdated: Timestamp;
}

interface FeeRecord {
  id: string;
  studentId: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending';
  paymentDate?: Timestamp;
}

interface Student {
  uid: string;
  name: string;
  email: string;
}

export default function FeeManagement({ profile }: { profile: any }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configText, setConfigText] = useState('');
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    studentId: '',
    amount: 0,
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as const
  });

  const isAdmin = profile.role === 'admin';
  const isStudent = profile.role === 'student';

  const fetchData = async () => {
    setLoading(true);
    try {
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const feesSnap = await getDocs(collection(db, 'fees'));

      setStudents(studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student)));
      setFees(feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeRecord)));

      // Fetch fee config
      const configSnap = await getDocs(collection(db, 'settings'));
      const feeConfigDoc = configSnap.docs.find(d => d.id === 'fee_config');
      if (feeConfigDoc) {
        const data = feeConfigDoc.data() as FeeConfig;
        setFeeConfig(data);
        setConfigText(data.accountDetails);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'fees', id), {
        id,
        ...formData,
        paymentDate: formData.status === 'paid' ? Timestamp.now() : null
      });
      setIsModalOpen(false);
      setFormData({ studentId: '', amount: 0, dueDate: format(new Date(), 'yyyy-MM-dd'), status: 'pending' });
      fetchData();
    } catch (error) {
      console.error('Error saving fee:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'paid' | 'pending') => {
    try {
      await setDoc(doc(db, 'fees', id), {
        status,
        paymentDate: status === 'paid' ? Timestamp.now() : null
      }, { merge: true });
      fetchData();
    } catch (error) {
      console.error('Error updating fee status:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await setDoc(doc(db, 'settings', 'fee_config'), {
        accountDetails: configText,
        lastUpdated: Timestamp.now()
      });
      setIsConfigModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving fee config:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFees = fees.filter(f => {
    const student = students.find(s => s.uid === f.studentId);
    const matchesSearch = student?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStudent = !isStudent || f.studentId === profile.uid;
    return matchesSearch && matchesStudent;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Fee Management</h1>
          <p className="text-gray-500 font-medium">
            {isAdmin ? 'Track and manage student payments' : 'View your fee status and history'}
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <>
              <button 
                onClick={() => setIsConfigModalOpen(true)}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Fee Account
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Fee Record
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fee Account Details for Students */}
      {feeConfig && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <CreditCard className="w-64 h-64 rotate-12" />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              Fee Payment Account Details
            </h2>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
              <pre className="whitespace-pre-wrap font-mono text-lg font-bold">
                {feeConfig.accountDetails}
              </pre>
              <button 
                onClick={() => copyToClipboard(feeConfig.accountDetails)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Details'}
              </button>
            </div>
            <p className="mt-4 text-blue-100 text-sm font-medium">
              Please pay your fees to the account above and share the receipt with the administration for approval.
            </p>
          </div>
        </motion.div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-500">Total Revenue</p>
          </div>
          <h3 className="text-2xl font-black text-gray-900">
            PKR {fees.filter(f => f.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-500">Pending Fees</p>
          </div>
          <h3 className="text-2xl font-black text-gray-900">
            PKR {fees.filter(f => f.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-500">Paid Records</p>
          </div>
          <h3 className="text-2xl font-black text-gray-900">
            {fees.filter(f => f.status === 'paid').length}
          </h3>
        </div>
      </div>

      {/* Search and List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by student name..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Due Date</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                {isAdmin && <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1,2,3].map(i => <tr key={i} className="h-20 animate-pulse bg-gray-50/20"></tr>)
              ) : filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium">No fee records found.</td>
                </tr>
              ) : (
                filteredFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold">
                          {students.find(s => s.uid === fee.studentId)?.name.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{students.find(s => s.uid === fee.studentId)?.name || 'Unknown Student'}</p>
                          <p className="text-xs text-gray-400 font-medium">{students.find(s => s.uid === fee.studentId)?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-gray-900">PKR {fee.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {fee.dueDate}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                        fee.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {fee.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleUpdateStatus(fee.id, fee.status === 'paid' ? 'pending' : 'paid')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            fee.status === 'paid' ? 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
                          }`}
                        >
                          {fee.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Fee Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Create Fee Record</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveFee} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Select Student</label>
                  <select 
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.studentId}
                    onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                  >
                    <option value="">Select Student</option>
                    {students.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Amount (PKR)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Due Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Initial Status</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['pending', 'paid'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData({...formData, status: status as any})}
                        className={`py-3 rounded-2xl font-bold capitalize transition-all border-2 ${
                          formData.status === status 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  Create Record
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fee Config Modal */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Fee Account Settings</h2>
                <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Account Details</label>
                  <textarea 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 min-h-[150px]"
                    placeholder="Enter bank name, account number, title, etc."
                    value={configText}
                    onChange={(e) => setConfigText(e.target.value)}
                  />
                  <p className="mt-2 text-xs text-gray-400 font-medium">This information will be visible to all students on their fee dashboard.</p>
                </div>
                <button 
                  onClick={handleSaveConfig}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
