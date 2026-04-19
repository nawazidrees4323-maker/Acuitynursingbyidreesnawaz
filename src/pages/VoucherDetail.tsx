// Forced update to trigger sync
import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, doc, setDoc, Timestamp, getDocs, orderBy } from '../lib/firebase';
import { Printer, Download, Search, Plus, CreditCard, User, History, CheckCircle2, ShieldCheck, Mail, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Voucher {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  subject: string;
  paymentDate: Timestamp;
  voucherNumber: string;
  createdAt: Timestamp;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export default function VoucherDetail({ profile }: { profile: any }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isAdmin = profile.role === 'admin';
  
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    subject: '',
    paymentDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'vouchers'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'vouchers'), where('studentId', '==', profile.uid));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setVouchers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Voucher)));
      setLoading(false);
    });

    if (isAdmin) {
      const fetchUsers = async () => {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        setUsers(snap.docs.map(doc => ({ uid: doc.id, name: doc.data().name, email: doc.data().email, role: doc.data().role })));
      };
      fetchUsers();
    }

    return () => unsub();
  }, [profile.uid, isAdmin]);

  const handleGenerateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const student = users.find(u => u.uid === formData.studentId);
      if (!student) return;

      const voucherId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const voucherNumber = `AN-${format(new Date(), 'yyyyMM')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const voucherData: Omit<Voucher, 'id'> = {
        studentId: formData.studentId,
        studentName: student.name,
        amount: Number(formData.amount),
        subject: formData.subject,
        paymentDate: Timestamp.fromDate(new Date(formData.paymentDate)),
        voucherNumber,
        createdAt: Timestamp.now()
      };

      await setDoc(doc(db, 'vouchers', voucherId), voucherData);

      // Send Email Notification
      const notificationId = Math.random().toString(36).substr(2, 9);
      const emailBody = `
        Dear ${student.name},
        
        Apka fee voucher generate ho gaya hai.
        
        Voucher Details:
        Number: ${voucherNumber}
        Amount: Rs. ${formData.amount}
        Session/Subject: ${formData.subject}
        Date: ${formData.paymentDate}
        
        Ap website par ja kar isay download ya print kar sakte hain.
        
        Regard,
        Acuity Nursing Academy
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: student.email,
          subject: `[VOUCHER] Fee Receipt - ${voucherNumber}`,
          body: emailBody
        })
      });

      // Also create in-app notification
      await setDoc(doc(db, 'notifications', notificationId), {
        id: notificationId,
        recipientId: student.uid,
        category: 'fee',
        title: 'Fee Voucher Generated',
        message: `Apka fee voucher (${voucherNumber}) Rs. ${formData.amount} ke liye generate ho gaya hai.`,
        read: false,
        createdAt: Timestamp.now()
      });

      setIsModalOpen(false);
      setFormData({ studentId: '', amount: '', subject: '', paymentDate: format(new Date(), 'yyyy-MM-dd') });
      alert('Voucher generated and email sent to student!');
    } catch (error) {
      console.error('Error generating voucher:', error);
      alert('Failed to generate voucher');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto print:p-0">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Fee Vouchers</h1>
          <p className="text-gray-500 font-medium">Manage and generate digital fee receipts</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Generate New Voucher
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse"></div>)}
        </div>
      ) : vouchers.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-gray-100 border-dashed print:hidden">
          <CreditCard className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-bold text-lg">No vouchers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
          {vouchers.map((v) => (
            <motion.div 
              key={v.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 relative overflow-hidden group hover:border-blue-200 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <History className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => setSelectedVoucher(v)}
                  className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{v.voucherNumber}</p>
                  <p className="text-xl font-bold text-gray-900 truncate">{v.studentName}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</p>
                    <p className="text-lg font-black text-blue-600">Rs. {v.amount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
                    <p className="text-sm font-bold text-gray-600">{format(v.paymentDate.toDate(), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Voucher Print View - ONLY VISIBLE DURING PRINT OR WHEN SELECTED */}
      <AnimatePresence>
        {selectedVoucher && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:relative print:p-0 print:bg-white print:inset-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden print:shadow-none print:max-w-none print:w-full print:rounded-none"
            >
              {/* Close Button - Hidden on Print */}
              <button 
                onClick={() => setSelectedVoucher(null)}
                className="absolute top-6 right-6 p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-xl print:hidden"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>

              {/* Voucher Content */}
              <div className="p-12 print:p-10 border-8 border-double border-blue-50/50 m-2 rounded-[2rem] print:border-blue-600 print:rounded-none">
                <div className="flex justify-between items-center mb-10 border-b-2 border-gray-100 pb-8 print:border-blue-600">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black">A</div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tighter">ACUITY NURSING ACADEMY</h2>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Excellence in Health Education</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xl font-black text-blue-600 uppercase tracking-widest">FEE VOUCHER</h3>
                    <p className="text-sm font-bold text-gray-500">No: {selectedVoucher.voucherNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10 mb-10">
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Student Name</p>
                      <p className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2">{selectedVoucher.studentName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Fee for Session/Subject</p>
                      <p className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2">{selectedVoucher.subject}</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Payment Date</p>
                      <p className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2">{format(selectedVoucher.paymentDate.toDate(), 'MMMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Paid Amount</p>
                      <p className="text-3xl font-black text-blue-600 border-b-2 border-blue-100 pb-1">Rs. {selectedVoucher.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-20 pt-10">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400">Generated on: {format(selectedVoucher.createdAt.toDate(), 'PPP p')}</p>
                    <div className="flex items-center gap-2 text-green-600 font-black text-sm uppercase tracking-widest">
                      <ShieldCheck className="w-5 h-5" />
                      Digitally Verified
                    </div>
                  </div>
                  
                  {/* Digital Stamp */}
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-blue-600/30 rounded-full border-dashed animate-spin-slow print:animate-none"></div>
                    <div className="w-32 h-32 border-8 border-blue-600/20 rounded-full flex flex-col items-center justify-center text-center p-2 rotate-[-15deg]">
                      <CheckCircle2 className="w-8 h-8 text-blue-600 mb-1" />
                      <p className="text-[10px] font-black text-blue-600 uppercase leading-none">Acuity Nursing Academy</p>
                      <p className="text-[8px] font-bold text-blue-400 uppercase">Registered & Verified</p>
                    </div>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-2 text-[8px] font-black text-blue-600 uppercase tracking-widest">OFFICIAL STAMP</div>
                  </div>
                </div>

                <div className="mt-12 text-center text-[10px] font-bold text-gray-400 border-t border-gray-100 pt-6 uppercase tracking-[0.2em] print:border-blue-100">
                  This is a system generated digital receipt and does not require a physical signature.
                </div>
              </div>

              {/* Print Action - Hidden on Print */}
              <div className="p-8 bg-gray-50 flex gap-4 print:hidden">
                <button 
                  onClick={() => setSelectedVoucher(null)}
                  className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-900 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  Close
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3"
                >
                  <Printer className="w-5 h-5" />
                  Print / Save as PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900 uppercase">Generate Voucher</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleGenerateVoucher} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Student</label>
                  <select 
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.studentId}
                    onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                  >
                    <option value="">Select Student...</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Paid Amount</label>
                    <input 
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Payment Date</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Session / Subject</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Test Session - Part 1"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Generate & Send to Gmail
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:relative, .print\\:relative * {
            visibility: visible;
          }
          .print\\:relative {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
