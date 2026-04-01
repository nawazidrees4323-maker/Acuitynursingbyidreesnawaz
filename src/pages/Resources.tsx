import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, setDoc, doc, deleteDoc, query, where } from '../lib/firebase';
import { Upload, FileText, Video, Book, Search, Plus, Trash2, ExternalLink, Filter, BookOpen, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Resource {
  id: string;
  title: string;
  type: 'pdf' | 'ppt' | 'video' | 'book' | 'slide';
  category: 'book' | 'slide';
  fileUrl: string;
  courseId: string;
  subjectId?: string;
  chapter?: string;
  createdAt: any;
}

interface Course { id: string; name: string; }
interface Subject { id: string; name: string; courseId: string; }

export default function Resources({ profile }: { profile: any }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'book' | 'slide'>('book');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    type: 'pdf' as const,
    category: 'book' as const,
    fileUrl: '',
    courseId: '',
    subjectId: '',
    chapter: ''
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

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingUploads, setPendingUploads] = useState<{ id: string; title: string; progress: number; status: 'uploading' | 'saving' | 'complete' | 'error' }[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress);
      }
    };

    reader.onloadend = () => {
      setFormData({ ...formData, fileUrl: reader.result as string });
      setIsUploading(false);
      setUploadProgress(100);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fileUrl) {
      alert('Please upload a file or provide a link');
      return;
    }

    const uploadId = Math.random().toString(36).substr(2, 9);
    const newUpload = {
      id: uploadId,
      title: formData.title,
      progress: 100,
      status: 'saving' as const
    };

    // Close modal immediately
    setIsModalOpen(false);
    setPendingUploads(prev => [...prev, newUpload]);

    // Store current form data to avoid closure issues with state updates
    const resourceData = { ...formData };
    setFormData({ title: '', type: 'pdf', category: 'book', fileUrl: '', courseId: '', subjectId: '', chapter: '' });
    setUploadProgress(0);

    try {
      await setDoc(doc(db, 'resources', uploadId), {
        id: uploadId,
        ...resourceData,
        createdAt: new Date()
      });
      
      setPendingUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'complete' as const } : u));
      
      // Remove from list after a delay
      setTimeout(() => {
        setPendingUploads(prev => prev.filter(u => u.id !== uploadId));
        fetchData();
      }, 3000);
    } catch (error) {
      console.error('Error saving resource:', error);
      setPendingUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error' as const } : u));
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
    const matchesCategory = r.category === activeTab;
    const matchesSubject = selectedSubject === 'all' || r.subjectId === selectedSubject;
    return matchesSearch && matchesCategory && matchesSubject;
  });

  // Group slides by subject and chapter
  const groupedSlides = filteredResources.reduce((acc: any, slide) => {
    const subjectName = subjects.find(s => s.id === slide.subjectId)?.name || 'General';
    if (!acc[subjectName]) acc[subjectName] = {};
    const chapter = slide.chapter || 'General';
    if (!acc[subjectName][chapter]) acc[subjectName][chapter] = [];
    acc[subjectName][chapter].push(slide);
    return acc;
  }, {});

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6" />;
      case 'ppt': return <BookOpen className="w-6 h-6" />;
      case 'video': return <Video className="w-6 h-6" />;
      case 'book': return <Book className="w-6 h-6" />;
      default: return <FileText className="w-6 h-6" />;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Background Uploads Indicator */}
      <div className="fixed bottom-8 right-8 z-[60] space-y-4 pointer-events-none">
        <AnimatePresence>
          {pendingUploads.map((upload) => (
            <motion.div
              key={upload.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 pointer-events-auto"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  upload.status === 'complete' ? 'bg-green-100 text-green-600' :
                  upload.status === 'error' ? 'bg-red-100 text-red-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {upload.status === 'complete' ? <CheckCircle2 className="w-6 h-6" /> :
                   upload.status === 'error' ? <AlertCircle className="w-6 h-6" /> :
                   <Loader2 className="w-6 h-6 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-900 text-sm truncate">{upload.title}</h4>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {upload.status === 'complete' ? 'Saved to Library' :
                     upload.status === 'error' ? 'Upload Failed' :
                     'Saving to Cloud...'}
                  </p>
                </div>
              </div>
              {upload.status === 'saving' && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2 }}
                    className="h-full bg-blue-600"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Digital Library</h1>
          <p className="text-gray-500 font-medium">Access recommended books and lecture slides</p>
        </div>
        {(isTeacher || isAdmin) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Add New Material
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-2 bg-white rounded-3xl border border-gray-100 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('book')}
          className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
            activeTab === 'book' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'
          }`}
        >
          Recommended Books
        </button>
        <button
          onClick={() => setActiveTab('slide')}
          className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
            activeTab === 'slide' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'
          }`}
        >
          Lecture Slides
        </button>
      </div>

      {/* Search & Subject Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'book' ? 'books' : 'slides'}...`} 
            className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {activeTab === 'slide' && (
          <select
            className="px-6 py-5 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 shadow-sm min-w-[200px]"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Content Display */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-[2.5rem] animate-pulse border border-gray-100"></div>)}
        </div>
      ) : activeTab === 'book' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredResources.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
              <Book className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">No books found in the library.</p>
            </div>
          ) : (
            filteredResources.map((book) => (
              <motion.div 
                key={book.id}
                whileHover={{ y: -10 }}
                className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all overflow-hidden group"
              >
                <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-8">
                  <div className="w-20 h-28 bg-white rounded-lg shadow-lg border border-blue-100 flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                    <Book className="w-10 h-10 text-blue-600" />
                  </div>
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-black text-gray-900 mb-2 line-clamp-2">{book.title}</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">
                    {courses.find(c => c.id === book.courseId)?.name || 'General Course'}
                  </p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => window.open(book.fileUrl, '_blank')}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Read
                    </button>
                    <a 
                      href={book.fileUrl} 
                      download={book.title}
                      className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-all"
                    >
                      <Upload className="w-5 h-5 rotate-180" />
                    </a>
                    {(isAdmin || isTeacher) && (
                      <button 
                        onClick={() => handleDeleteResource(book.id)}
                        className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {Object.keys(groupedSlides).length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
              <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">No slides uploaded yet.</p>
            </div>
          ) : (
            Object.entries(groupedSlides).map(([subjectName, chapters]: any) => (
              <div key={subjectName} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-200"></div>
                  <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em]">{subjectName}</h2>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                
                <div className="grid grid-cols-1 gap-8">
                  {Object.entries(chapters).map(([chapter, slides]: any) => (
                    <div key={chapter} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                      <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                        {chapter}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {slides.map((slide: any) => (
                          <motion.div 
                            key={slide.id}
                            whileHover={{ scale: 1.02 }}
                            className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                {slide.type === 'ppt' ? <BookOpen className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900">{slide.title}</h4>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{slide.type}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => window.open(slide.fileUrl, '_blank')}
                                className="p-2 bg-white text-blue-600 rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <a 
                                href={slide.fileUrl} 
                                download={slide.title}
                                className="p-2 bg-white text-gray-600 rounded-xl shadow-sm hover:bg-gray-100 transition-all"
                              >
                                <Upload className="w-4 h-4 rotate-180" />
                              </a>
                              {(isAdmin || isTeacher) && (
                                <button 
                                  onClick={() => handleDeleteResource(slide.id)}
                                  className="p-2 bg-white text-red-500 rounded-xl shadow-sm hover:bg-red-50 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden my-8"
            >
              <div className="p-10 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Add Learning Material</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl text-gray-400">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveResource} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-4 p-2 bg-gray-50 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, category: 'book'})}
                    className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      formData.category === 'book' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    Recommended Book
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, category: 'slide'})}
                    className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      formData.category === 'slide' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    Lecture Slide
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Title</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      placeholder="e.g. Anatomy & Physiology 10th Ed"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Course</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.courseId}
                      onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.subjectId}
                      onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                    >
                      <option value="">Select Subject</option>
                      {subjects.filter(s => s.courseId === formData.courseId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {formData.category === 'slide' && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Chapter Name</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                        placeholder="e.g. Chapter 1: The Skeletal System"
                        value={formData.chapter}
                        onChange={(e) => setFormData({...formData, chapter: e.target.value})}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">File Type</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="pdf">PDF Document</option>
                      <option value="ppt">PowerPoint</option>
                      <option value="video">Video Link</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Upload File</label>
                    <div className="relative space-y-2">
                      <input 
                        type="file" 
                        accept=".pdf,.ppt,.pptx,.doc,.docx,image/*"
                        onChange={handleFileChange}
                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                        disabled={isUploading}
                      />
                      {(isUploading || uploadProgress > 0) && (
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            className="h-full bg-blue-600"
                          />
                        </div>
                      )}
                      {uploadProgress === 100 && !isUploading && (
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          File Ready
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUploading || !formData.fileUrl}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                  >
                    {isUploading ? 'Reading File...' : 'Save to Library'}
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
