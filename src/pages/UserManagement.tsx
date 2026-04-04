import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, setDoc, doc, deleteDoc, Timestamp, query, where } from '../lib/firebase';
import { UserPlus, Search, Edit2, Trash2, MoreVertical, CheckCircle2, XCircle, Mail, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  status: 'pending' | 'approved' | 'rejected';
  photoURL?: string;
  createdAt: Timestamp;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student' as const,
    status: 'approved' as const,
    uid: ''
  });

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile & { password?: string }));
      setUsers(usersData as any);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const uid = editingUser ? editingUser.uid : (formData.uid || Math.random().toString(36).substr(2, 9));
      const userRef = doc(db, 'users', uid);
      
      const userData = {
        uid,
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        status: formData.status,
        resetRequested: false, // Clear reset request when saved
        createdAt: editingUser ? editingUser.createdAt : Timestamp.now(),
      };

      await setDoc(userRef, userData, { merge: true });
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'student', status: 'approved', uid: '' });
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleStatusUpdate = async (uid: string, newStatus: 'approved' | 'rejected') => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { status: newStatus }, { merge: true });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">User Management</h1>
          <p className="text-gray-500 font-medium">Approve registrations and manage user roles</p>
        </div>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: '', email: '', role: 'student', status: 'approved', uid: '' });
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Add New User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-gray-600 min-w-[150px]"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="teacher">Teachers</option>
            <option value="student">Students</option>
          </select>
          <select 
            className="px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-gray-600 min-w-[150px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">User</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-8 py-6 h-20 bg-gray-50/20"></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-medium">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img 
                          src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                          alt={user.name}
                          className="w-12 h-12 rounded-2xl border-2 border-white shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-gray-900">{user.name}</p>
                          <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                        user.role === 'admin' ? 'bg-purple-50 text-purple-600' :
                        user.role === 'teacher' ? 'bg-green-50 text-green-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                          user.status === 'approved' ? 'bg-green-50 text-green-600' :
                          user.status === 'rejected' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {user.status}
                        </span>
                        {(user as any).resetRequested && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-black uppercase tracking-widest text-center">
                            Reset Requested
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleStatusUpdate(user.uid, 'approved')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Approve"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(user.uid, 'rejected')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => {
                            setEditingUser(user);
                            setFormData({ 
                              name: user.name, 
                              email: user.email, 
                              password: (user as any).password || '',
                              role: user.role, 
                              status: user.status, 
                              uid: user.uid 
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.uid)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                  <input 
                    required
                    type="email" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Password</label>
                  <input 
                    required={!editingUser}
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="Set user password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <p className="mt-1 text-[10px] text-gray-400 font-medium">For students to login via email/password</p>
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">User Role</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['student', 'teacher', 'admin'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({...formData, role: role as any})}
                        className={`py-3 rounded-2xl font-bold capitalize transition-all border-2 ${
                          formData.role === role 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Status</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['pending', 'approved', 'rejected'].map((status) => (
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

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
