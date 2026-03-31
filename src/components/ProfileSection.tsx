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
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row items-center gap-8">
      <div className="relative group">
        <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center">
          {photoURL ? (
            <img 
              src={photoURL} 
              alt={profile.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-12 h-12 text-gray-300" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-[2rem]">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
        <label className="absolute -bottom-2 -right-2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg cursor-pointer hover:bg-blue-700 transition-all group-hover:scale-110">
          <Camera className="w-5 h-5" />
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>
      </div>
      
      <div className="text-center md:text-left flex-1">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
          <h2 className="text-3xl font-black text-gray-900">{profile.name}</h2>
          <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-widest w-fit mx-auto md:mx-0">
            {profile.role}
          </span>
        </div>
        <p className="text-gray-500 font-medium mb-4">{profile.email}</p>
        <div className="flex flex-wrap justify-center md:justify-start gap-4">
          <div className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 border border-gray-100">
            Status: <span className="text-green-600 uppercase">{profile.status}</span>
          </div>
          <div className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 border border-gray-100">
            Joined: {profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : 'Recently'}
          </div>
        </div>
      </div>
    </div>
  );
}
