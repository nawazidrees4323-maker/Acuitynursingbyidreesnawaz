import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, query, where, Timestamp, onSnapshot } from '../lib/firebase';
import { Bell, Plus, Search, Trash2, CheckCircle2, User, Send, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  createdAt: Timestamp;
  read: boolean;
}

interface UserProfile {
  uid: string;
  name: string;
  role: string;
}

export default function Notifications({ profile }: { profile: any }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    recipientId: 'all',
    title: '',
    message: ''
  });

  const isTeacher = profile.role === 'teacher';
  const isAdmin = profile.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'notifications'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      const filtered = notifs.filter(n => n.recipientId === profile.uid || n.recipientId === 'all');
      setNotifications(filtered.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      setLoading(false);
    });

    const fetchUsers = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, name: doc.data().name, role: doc.data().role })));
    };

    fetchUsers();
    return () => unsubscribe();
  }, [profile.uid]);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'notifications', id), {
        id,
        ...formData,
        createdAt: Timestamp.now(),
        read: false
      });
      setIsModalOpen(false);
      setFormData({ recipientId: 'all', title: '', message: '' });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await setDoc(doc(db, 'notifications', id), { read: true }, { merge: true });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this notification?')) {
      await deleteDoc(doc(db, 'notifications', id));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Notifications</h1>
          <p className="text-gray-500 font-medium">Stay updated with the latest announcements</p>
        </div>
        {(isAdmin || isTeacher) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            Send Notification
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-3xl animate-pulse"></div>)
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">
            No notifications yet.
          </div>
        ) : notifications.map((notif) => (
          <motion.div 
            key={notif.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-6 rounded-3xl border transition-all ${
              notif.read ? 'bg-white border-gray-100' : 'bg-blue-50/50 border-blue-100 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-5">
              <div className={`p-3 rounded-2xl shrink-0 ${notif.read ? 'bg-gray-50 text-gray-400' : 'bg-blue-600 text-white'}`}>
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-lg font-bold truncate ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {notif.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 shrink-0 ml-4">
                    <Clock className="w-3.5 h-3.5" />
                    {format(notif.createdAt.toDate(), 'MMM d, h:mm a')}
                  </div>
                </div>
                <p className={`text-sm font-medium leading-relaxed mb-4 ${notif.read ? 'text-gray-500' : 'text-gray-600'}`}>
                  {notif.message}
                </p>
                <div className="flex items-center justify-between">
                  {notif.recipientId === 'all' ? (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-black uppercase tracking-widest">Broadcast</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-black uppercase tracking-widest">Personal</span>
                  )}
                  <div className="flex items-center gap-2">
                    {!notif.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                    {(isAdmin || isTeacher) && (
                      <button 
                        onClick={() => handleDelete(notif.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Send Notification Modal */}
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
                <h2 className="text-2xl font-black text-gray-900">Send Notification</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSendNotification} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Recipient</label>
                  <select 
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.recipientId}
                    onChange={(e) => setFormData({...formData, recipientId: e.target.value})}
                  >
                    <option value="all">All Students & Teachers</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="Important Announcement"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Message</label>
                  <textarea 
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 h-32 resize-none"
                    placeholder="Enter your message here..."
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  Send Now
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
