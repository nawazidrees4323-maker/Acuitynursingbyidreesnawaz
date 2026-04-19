import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, setDoc, doc, deleteDoc, Timestamp, query, orderBy } from '../lib/firebase';
import { Calendar, Plus, Trash2, Clock, BookOpen, AlertCircle, Upload, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

interface QuizScheduleItem {
  id: string;
  date: string;
  day: string;
  subject: string;
  topic: string;
  time: string;
  createdAt: Timestamp;
}

export default function QuizSchedule({ profile }: { profile: any }) {
  const [schedules, setSchedules] = useState<QuizScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    subject: '',
    topic: '',
    time: '09:00 PM'
  });

  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'quiz_schedule'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as QuizScheduleItem)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const dateObj = new Date(formData.date);
      const day = format(dateObj, 'EEEE');

      await setDoc(doc(db, 'quiz_schedule', id), {
        ...formData,
        id,
        day,
        createdAt: Timestamp.now()
      });

      setIsModalOpen(false);
      setFormData({ date: format(new Date(), 'yyyy-MM-dd'), subject: '', topic: '', time: '09:00 PM' });
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule');
    }
  };

  const handleBulkUpload = async () => {
    const lines = bulkText.trim().split('\n');
    let successCount = 0;
    
    for (const line of lines) {
      // Expected format: Date (YYYY-MM-DD), Subject, Topic, Time
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        try {
          const [date, subject, topic, time = '09:00 PM'] = parts;
          const id = Math.random().toString(36).substr(2, 9);
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) continue;
          
          const day = format(dateObj, 'EEEE');
          await setDoc(doc(db, 'quiz_schedule', id), {
            id,
            date,
            day,
            subject,
            topic,
            time,
            createdAt: Timestamp.now()
          });
          successCount++;
        } catch (e) {
          console.error('Error processing line:', line, e);
        }
      }
    }
    
    alert(`${successCount} schedules uploaded successfully!`);
    setIsBulkOpen(false);
    setBulkText('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this schedule?')) {
      await deleteDoc(doc(db, 'quiz_schedule', id));
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Quiz Schedule</h1>
          <p className="text-gray-500 font-medium">Weekly and monthly test sessions timeline</p>
        </div>
        {(isAdmin || isTeacher) && (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsBulkOpen(true)}
              className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Bulk Upload
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Session
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-[2rem] animate-pulse"></div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-gray-100 border-dashed">
          <Calendar className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-bold text-lg">No quiz sessions scheduled yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-50 relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -mr-8 -mt-8 -z-10 group-hover:bg-blue-100/50 transition-colors"></div>
              
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-blue-600/5 text-blue-600 rounded-3xl">
                  <Calendar className="w-8 h-8" />
                </div>
                {(isAdmin || isTeacher) && (
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-1">{item.subject}</h3>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{item.topic}</p>
                </div>

                <div className="pt-4 border-t border-gray-50 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-gray-500 font-bold text-sm">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {item.time}
                  </div>
                  <div className="flex items-center gap-2 text-gray-900 font-black text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    {item.day}, {format(new Date(item.date), 'MMM d')}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {isBulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Bulk Upload Schedule</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Add multiple sessions at once</p>
                  </div>
                </div>
                <button onClick={() => setIsBulkOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div className="text-sm">
                    <p className="text-amber-800 font-black mb-1 uppercase tracking-tight">Instructions:</p>
                    <p className="text-amber-700 font-medium leading-relaxed">
                      Enter each session on a new line using the format:<br />
                      <code className="bg-white/50 px-1 rounded font-bold">YYYY-MM-DD, Subject, Topic, Time</code><br />
                      Example: <code className="bg-white/30 px-1 rounded italic text-xs">2024-05-20, Anatomy, Skeletal System, 08:00 PM</code>
                    </p>
                  </div>
                </div>

                <textarea 
                  className="w-full h-64 px-6 py-5 bg-gray-50 border-none rounded-3xl focus:ring-4 focus:ring-blue-100 font-mono text-sm text-gray-900 resize-none shadow-inner"
                  placeholder="2024-05-20, Anatomy, Bones, 09:00 PM
2024-05-21, Physics, Optics, 08:30 PM..."
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />

                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsBulkOpen(false)}
                    className="flex-1 py-5 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkUpload}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <Save className="w-5 h-5" />
                    Upload All Sessions
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single Add Modal */}
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
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Add Session</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Quiz Date</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Time</label>
                    <input 
                      type="text"
                      required
                      placeholder="09:00 PM"
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Fundamental of Nursing"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Topic</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Communication Skills"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold text-gray-900"
                    value={formData.topic}
                    onChange={(e) => setFormData({...formData, topic: e.target.value})}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                  >
                    Save Session
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
