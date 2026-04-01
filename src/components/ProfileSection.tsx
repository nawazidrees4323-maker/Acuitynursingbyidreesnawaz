import React, { useState } from 'react';
import { db, doc, setDoc, auth } from '../lib/firebase';
import { Camera, Loader2, User } from 'lucide-react';
import { motion } from 'motion/react';

export default function ProfileSection({ profile }: { profile: any }) {
  const [isUploading, setIsUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await setDoc(doc(db, 'users', profile.uid), { photoURL: base64 }, { merge: true });
        setPhotoURL(base64);
        // Also update local storage if needed, but Firebase will sync on next reload
      } catch (error) {
        console.error('Error updating photo:', error);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white p-4 lg:p-6 rounded-[2rem] border border-gray-100 shadow-sm mb-6 flex flex-col sm:flex-row items-center gap-4 lg:gap-8">
      <div className="relative group">
        <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-gray-50 flex items-center justify-center">
          {photoURL ? (
            <img 
              src={photoURL} 
              alt={profile.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-10 h-10 text-gray-300" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl lg:rounded-3xl">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
        <label className="absolute -bottom-1 -right-1 p-2 bg-blue-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-all group-hover:scale-110">
          <Camera className="w-4 h-4" />
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>
      </div>
      
      <div className="text-center sm:text-left flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
          <h2 className="text-xl lg:text-2xl font-black text-gray-900">{profile.name}</h2>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit mx-auto sm:mx-0">
            {profile.role}
          </span>
        </div>
        <p className="text-sm text-gray-500 font-medium mb-3">{profile.email}</p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-3">
          <div className="px-3 py-1 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 border border-gray-100">
            Status: <span className="text-green-600 uppercase">{profile.status}</span>
          </div>
          <div className="px-3 py-1 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 border border-gray-100">
            Joined: {profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : 'Recently'}
          </div>
        </div>
      </div>
    </div>
  );
}
