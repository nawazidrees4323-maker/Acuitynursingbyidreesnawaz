import React from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Users, ExternalLink, GraduationCap, Heart, ShieldCheck, Globe } from 'lucide-react';

export default function AboutAcademy() {
  return (
    <div className="space-y-12 font-sans max-w-6xl mx-auto pb-20">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-[400px] rounded-[3rem] overflow-hidden shadow-2xl"
      >
        <img 
          src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=2070" 
          alt="Nursing Academy" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 via-blue-900/40 to-transparent flex flex-col justify-end p-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-5xl font-black text-white mb-4 tracking-tight">Acuity Nursing Academy</h1>
            <p className="text-xl text-blue-100 max-w-2xl font-medium leading-relaxed">
              Empowering the next generation of healthcare professionals with excellence in education and clinical practice.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: Heart, label: 'Compassion', color: 'bg-red-50 text-red-600' },
          { icon: ShieldCheck, label: 'Excellence', color: 'bg-green-50 text-green-600' },
          { icon: Globe, label: 'Innovation', color: 'bg-blue-50 text-blue-600' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6"
          >
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <span className="text-xl font-black text-gray-900 uppercase tracking-widest text-sm">{stat.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Social Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-[#25D366] to-[#128C7E] p-10 rounded-[3rem] text-white shadow-xl shadow-green-100 group cursor-pointer"
          onClick={() => window.open('https://whatsapp.com/channel/0029VaRjT2LDuMRhpP3WFW3L', '_blank')}
        >
          <div className="flex items-start justify-between mb-8">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center">
              <MessageCircle className="w-8 h-8" />
            </div>
            <ExternalLink className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="text-3xl font-black mb-2">WhatsApp Channel</h3>
          <p className="text-green-50 font-medium mb-6">Stay updated with the latest news, exam dates, and academy announcements.</p>
          <div className="inline-flex items-center gap-2 bg-white text-green-600 px-6 py-3 rounded-2xl font-bold text-sm">
            Join Channel
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-600 to-blue-800 p-10 rounded-[3rem] text-white shadow-xl shadow-blue-100 group cursor-pointer"
          onClick={() => window.open('https://chat.whatsapp.com/CMQXRlbjbJcBoppoIaDnzl', '_blank')}
        >
          <div className="flex items-start justify-between mb-8">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
            <ExternalLink className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="text-3xl font-black mb-2">Community Group</h3>
          <p className="text-blue-50 font-medium mb-6">Connect with fellow students, share resources, and participate in group discussions.</p>
          <div className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold text-sm">
            Join Community
          </div>
        </motion.div>
      </div>

      {/* Mission Section */}
      <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm">
        <div className="max-w-3xl">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-6 tracking-tight">Our Mission</h2>
          <p className="text-lg text-gray-500 font-medium leading-relaxed mb-8">
            Acuity Nursing Academy is dedicated to providing high-quality nursing education through innovative teaching methods and hands-on clinical training. We believe in nurturing compassionate healthcare leaders who are equipped to meet the challenges of modern medicine.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              'Expert Faculty Members',
              'Modern Learning Resources',
              'Clinical Training Support',
              'Career Guidance & Mentorship'
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-700 font-bold">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
