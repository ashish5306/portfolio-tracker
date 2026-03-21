'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState('individual'); // 'individual' or 'company'
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          user_type: userType,
        },
      },
    });

    if (error) alert(error.message);
    else {
      alert('Verification email sent! Check your inbox.');
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl p-10 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Equity_Edge</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Create your account</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['individual', 'company'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setUserType(type)}
                className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${userType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              > {type} </button>
            ))}
          </div>

          <input 
            type="text" 
            placeholder={userType === 'company' ? "Corporate / AMC Name" : "Full Name"} 
            className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-xs"
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <input 
            type="email" 
            placeholder="Email Address" 
            className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-xs"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input 
            type="password" 
            placeholder="Password" 
            className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-xs"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-600 transition-all shadow-lg">
            Register as {userType}
          </button>
        </form>
      </div>
    </div>
  );
}