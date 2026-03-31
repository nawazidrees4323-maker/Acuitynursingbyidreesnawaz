import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, query, where } from '../lib/firebase';
import { Upload, FileText, Video, Book, Search, Plus, Trash2, ExternalLink, Filter, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Resource {
  id: string;
  title: string;
  type: 'pdf' | 'ppt' | 'video' | 'book';
  fileUrl: string;
  courseId: string;
  subjectId?: string;
}

interface Course {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  courseId: string;
}

export default function Resources({ profile }: { profile: any }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    type: 'pdf' as const,
    fileUrl: '',
    courseId: '',
    subjectId: ''
  });

  const isTeacher = profile.role === 'teacher';
  const isAdmin = profile.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const resourcesSnap = await getDocs(collection(db, 'resources'));
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const subjectsSnap = await getDocs(collection(db, 'subjects'));

      setResources(resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'resources', id), {
        id,
        ...formData
      });
      setIsModalOpen(false);
      setFormData({ title: '', type: 'pdf', fileUrl: '', courseId: '', subjectId: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving resource:', error);
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (window.confirm('Delete this resource?')) {
      await deleteDoc(doc(db, 'resources', id));
      fetchData();
    }
  };

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || r.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6" />;
      case 'ppt': return <BookOpen className="w-6 h-6" />;
      case 'video': return <Video className="w-6 h-6" />;
      case 'book': return <Book className="w-6 h-6" />;
      default: return <FileText className="w-6 h-6" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pdf': return 'bg-red-50 text-red-600';
      case 'ppt': return 'bg-orange-50 text-orange-600';
      case 'video': return 'bg-blue-50 text-blue-600';
      case 'book': return 'bg-green-50 text-green-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Learning Resources</h1>
          <p className="text-gray-500 font-medium">
            Access PPTs, PDFs, videos, and recommended books
          </p>
        </div>
        {(isTeacher || isAdmin) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Upload Resource
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search resources..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pdf', 'ppt', 'video', 'book'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                filterType === type 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse"></div>)
        ) : filteredResources.length === 0 ? (
          <div className="col-span-full py-20 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">
            No resources found.
          </div>
        ) : filteredResources.map((resource) => (
          <motion.div 
            key={resource.id}
            whileHover={{ y: -5 }}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="p-8 flex-1">
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl ${getTypeColor(resource.type)}`}>
                  {getIcon(resource.type)}
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${getTypeColor(resource.type)}`}>
                  {resource.type}
                </span>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">{resource.title}</h3>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
                <BookOpen className="w-4 h-4" />
                {courses.find(c => c.id === resource.courseId)?.name || 'Course'}
              </div>
            </div>
            <div className="p-4 bg-gray-50/50 border-t border-gray-50 flex gap-2">
              <a 
                href={resource.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-white border border-gray-100 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Resource
              </a>
              {(isTeacher || isAdmin) && (
                <button 
                  onClick={() => handleDeleteResource(resource.id)}
                  className="p-3 bg-white border border-gray-100 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Upload Modal */}
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
                <h2 className="text-2xl font-black text-gray-900">Upload Resource</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveResource} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="Lecture 1: Introduction"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Type</label>
                    <select 
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="pdf">PDF Document</option>
                      <option value="ppt">PowerPoint</option>
                      <option value="video">Video Link</option>
                      <option value="book">Recommended Book</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Course</label>
                    <select 
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.courseId}
                      onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">File URL</label>
                  <input 
                    required
                    type="url" 
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                    placeholder="https://..."
                    value={formData.fileUrl}
                    onChange={(e) => setFormData({...formData, fileUrl: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  Upload Now
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
