'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // 1. Attempt Sign In
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login Error: " + error.message);
      setLoading(false);
      return;
    }

    // 2. FORCE REFRESH: This ensures the Middleware sees the new cookie
    if (data?.user) {
      router.refresh(); 
      router.push('/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) alert(error.message);
    else alert("Password reset link sent to your email!");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl p-10 space-y-6 text-center border border-slate-100">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Equity_Edge</h1>
        
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <input 
            type="email" 
            placeholder="Work Email" 
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
          
          <button 
            type="button"
            onClick={handleForgotPassword}
            className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 ml-4 transition-colors"
          >
            Forgot Password?
          </button>

          <button 
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-600 shadow-lg disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
        
        <p className="text-[10px] font-black text-slate-400 uppercase">
          New Entity? <Link href="/register" className="text-blue-600 hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
}