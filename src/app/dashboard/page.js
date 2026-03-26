'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Portfolio from '@/components/Portfolio';

export default function DashboardPage() {
  const [activePortfolio, setActivePortfolio] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const router = useRouter();

  // FETCH PORTFOLIOS: Simple read from the database columns
  const fetchPortfolios = useCallback(async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (!error) setPortfolios(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        fetchPortfolios(authUser.id);
      }
    };
    initAuth();
  }, [router, fetchPortfolios]);

  // REFRESH ON BACK: When coming back from a portfolio, we get the newly synced stats
  const handleBack = () => {
    setActivePortfolio(null);
    if (user) fetchPortfolios(user.id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newPortfolioName || !user) return;
    const { data, error } = await supabase
      .from('portfolios')
      .insert([{ name: newPortfolioName.toUpperCase(), user_id: user.id }])
      .select();
    
    if (!error) {
      setPortfolios([...portfolios, data[0]]);
      setNewPortfolioName('');
    }
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (!confirm(`Permanently delete "${name}"? All transaction history will be lost.`)) return;
    
    // Manual cleanup of transactions first
    await supabase.from('transactions').delete().eq('portfolio_id', id);
    const { error } = await supabase.from('portfolios').delete().eq('id', id);
    
    if (!error) {
      setPortfolios(prev => prev.filter(p => p.id !== id));
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] text-slate-900 font-sans selection:bg-blue-100">
      
      {/* SIDEBAR */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-50 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic shadow-lg shrink-0">E</div>
          {isSidebarOpen && <span className="ml-3 font-black text-xl italic tracking-tighter uppercase shrink-0">PT Tracker</span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-hidden mt-4">
          {[
            { label: 'Dashboard', icon: '⊞', active: true },
            { label: 'Market Watch', icon: '📊' },
            { label: 'Analytics', icon: '📋' },
            { label: 'Tools', icon: '🛠️' },
            { label: 'Settings', icon: '⚙' }
          ].map((item) => (
            <button key={item.label} className={`w-full flex items-center h-12 px-3 rounded-xl transition-all ${item.active ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-xl w-8 flex justify-center">{item.icon}</span>
              {isSidebarOpen && <span className="ml-3 font-bold text-xs uppercase tracking-widest leading-none">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-50">
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-full h-12 flex items-center px-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-all">
            <span className="text-xl w-8 flex justify-center">⎗</span>
            {isSidebarOpen && <span className="ml-3 font-black text-[10px] uppercase tracking-widest leading-none">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all">
              {isSidebarOpen ? '⇠' : '⇢'}
            </button>
            <h2 className="font-black italic uppercase tracking-tighter text-slate-900 leading-none">Terminal <span className="text-blue-600">v3.0</span></h2>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 shadow-sm">
             <div className="w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-inner">👤</div>
             <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">
               {user?.email?.split('@')[0]}
             </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 scroll-smooth">
          {activePortfolio ? (
            <Portfolio portfolio={activePortfolio} onBack={handleBack} />
          ) : (
            <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
              <div className="space-y-1">
                <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">All Portfolio</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">InstPitutional Asset Control Dashboard</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {/* CREATE NEW FUND CARD */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between min-h-[300px] hover:border-blue-200 transition-all">
                  <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">ADD NEW PORTFOLIO</h3>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <input 
                      value={newPortfolioName} 
                      onChange={(e) => setNewPortfolioName(e.target.value)} 
                      placeholder="PORTFOLIO NAME" 
                      className="w-full bg-slate-50 p-5 rounded-2xl font-black uppercase text-[10px] outline-none focus:ring-2 ring-blue-500/20 border border-slate-100 transition-all" 
                    />
                    <button className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-600 transition-all active:scale-95">ADD PORTFOLIO</button>
                  </form>
                </div>

                {/* PORTFOLIO BENTO CARDS */}
                {portfolios.map((p) => {
                  const aum = p.last_aum || 0;
                  const cagr = p.last_cagr || 0;
                  
                  // Color Logic Mirroring Portfolio Page
                  const pillClass = cagr >= 10 ? 'bg-emerald-50 text-emerald-600' : 
                                    cagr >= 5  ? 'bg-amber-50 text-amber-600' : 
                                                 'bg-rose-50 text-rose-600';

                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setActivePortfolio(p)} 
                      className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-[0_20px_50px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-500 group cursor-pointer min-h-[300px] flex flex-col justify-between relative"
                    >
                      <button 
                        onClick={(e) => handleDelete(p.id, p.name, e)} 
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all z-20 border border-slate-100 shadow-sm"
                      >
                        ✕
                      </button>
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm group-hover:bg-blue-600 transition-colors shadow-lg leading-none">
                             {p.name.charAt(0)}
                           </div>
                           <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${pillClass}`}>
                             {cagr >= 0 ? '▲' : '▼'} {cagr.toFixed(1)}% CAGR
                           </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 uppercase italic leading-tight group-hover:text-blue-600 transition-colors">{p.name}</h3>
                      </div>

                      <div className="pt-6 border-t border-slate-50 flex items-end justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Assets (AUM)</p>
                          <p className="text-3xl font-black text-slate-900 tabular-nums italic tracking-tighter">৳{aum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}