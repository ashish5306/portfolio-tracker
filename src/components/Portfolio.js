'use client';

import { useState, useEffect, useRef } from 'react';
import xirr from 'xirr';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const COLORS = ['#2563eb', '#10b981', '#f59e0b'];
const SHANTA_MF_SYMBOLS = ["SHANTA FIRST INCOME FUND", "SHANTA AMANAH SHARIAH FUND", "SHANTA FIXED INCOME FUND"];

export default function Portfolio({ portfolio, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState('');
  const [assetType, setAssetType] = useState('Stock');
  const [txType, setTxType] = useState('Buy');
  const [divSubtype, setDivSubtype] = useState('Cash');
  const [isInterestBearing, setIsInterestBearing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSync, setLastSync] = useState(null);
 
  const [symbolInput, setSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef(null);

  const [stockPrices, setStockPrices] = useState({});
  const [dbSymbols, setDbSymbols] = useState({ stocks: [], others: [] });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const today = new Date().toLocaleDateString('en-CA');

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '৳0';
    const absVal = Math.abs(val);
    let formatted = '';
    if (absVal >= 1000000) {
      formatted = (val / 1000000).toFixed(2) + 'M';
    } else if (absVal >= 100000) {
      formatted = (val / 1000).toFixed(2) + 'K';
    } else {
      formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return `৳${formatted}`;
  };

  const formatPNL = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '৳0';
    const absVal = Math.abs(val);
    let formatted = '';
    if (absVal >= 1000000) {
      formatted = Math.round(val / 1000000) + 'M';
    } else if (absVal >= 100000) {
      formatted = Math.round(val / 1000) + 'K';
    } else {
      formatted = Math.round(val).toLocaleString();
    }
    return `৳${formatted}`;
  };

  const loadData = async () => {
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('date', { ascending: true });

    if (!txError) setTransactions(txData || []);
   
    const { data: priceData, error: priceError } = await supabase
      .from('market_prices')
      .select('name, price, asset_class, updated_at');

    if (!priceError && priceData) {
      const livePriceMap = {};
      const stocks = [];
      const others = [];

      if (priceData.length > 0) {
        const latest = new Date(Math.max(...priceData.map(e => new Date(e.updated_at))));
        // Updated to include the year
        setLastSync(latest.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' }));
      }

      priceData.forEach(item => {
        const name = item.name.trim().toUpperCase();
        livePriceMap[name] = item.price;
        if (item.asset_class === 'Stock' || name === 'VOO') {
          stocks.push(name);
        } else if (name === 'IAUM') {
          others.push(name);
        }
      });

      setStockPrices(livePriceMap);
      setDbSymbols({ stocks, others });
    }
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();
  }, [portfolio.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = () => {
    const exportData = transactions.map(t => ({
      Date: t.date, Ticker: t.name, Type: t.type, Subtype: t.subtype || '',
      Asset_Class: t.asset_class, Quantity: t.units, Price: t.price,
      Total_Amount: (t.units || 1) * (t.price || 0),
      Interest_Bearing: t.is_interest_bearing ? 'Yes' : 'No',
      Interest_Rate: t.interest_rate || 0
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `${portfolio.name}_Ledger_${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (confirm(`Import ${data.length} records into ${portfolio.name}?`)) {
          const { data: { user } } = await supabase.auth.getUser();
          const formattedTxs = data.map(row => ({
            portfolio_id: portfolio.id, user_id: user.id, date: row.Date,
            name: row.Ticker?.toString().toUpperCase(), type: row.Type,
            subtype: row.Subtype || null, asset_class: row.Asset_Class || 'Stock',
            units: parseFloat(row.Quantity) || 0, price: parseFloat(row.Price) || 0,
            is_interest_bearing: row.Interest_Bearing === 'Yes',
            interest_rate: parseFloat(row.Interest_Rate) || 0
          }));
          const { error } = await supabase.from('transactions').insert(formattedTxs);
          if (!error) window.location.reload();
          else alert("Import Failed.");
        }
      } catch (err) { alert("Error processing file."); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSymbolChange = (e) => {
    const value = e.target.value.toUpperCase();
    setSymbolInput(value);
    
    // Strict filtering logic for suggestions
    let list = [];
    if (assetType === 'Stock') list = dbSymbols.stocks;
    else if (assetType === 'Mutual Fund') list = SHANTA_MF_SYMBOLS;
    else if (assetType === 'Others') list = dbSymbols.others;

    if (list.length > 0 && value.length > 0) {
      setSuggestions(list.filter(s => s.toUpperCase().includes(value)).slice(0, 6));
      setShowSuggestions(true);
    } else setShowSuggestions(false);
  };

  const getStats = (itemOrName) => {
    const tName = (typeof itemOrName === 'string' ? itemOrName : itemOrName.name).toUpperCase().trim();
    const txs = transactions.filter(t => t.name.toUpperCase().trim() === tName).sort((a, b) => new Date(a.date) - new Date(b.date));
   
    let currentUnits = 0, totalCostBasis = 0, realizedPnL = 0, cashFlows = [], interestRate = 0, firstBuyDate = null;

    txs.forEach(t => {
      const amount = (t.units || 0) * (t.price || 0);
      const tDate = new Date(t.date);
      if (t.type === 'Buy') {
        currentUnits += (t.units || 0); totalCostBasis += amount;
        interestRate = t.interest_rate || 0;
        if (!firstBuyDate) firstBuyDate = tDate;
        cashFlows.push({ amount: -amount, when: tDate });
      } else if (t.type === 'Sell') {
        const avgCost = totalCostBasis / (currentUnits || 1);
        realizedPnL += ((t.price || 0) - avgCost) * (t.units || 0);
        totalCostBasis -= (avgCost * (t.units || 0));
        currentUnits -= (t.units || 0);
        cashFlows.push({ amount: amount, when: tDate });
      } else if (t.type === 'Dividend') {
        if (t.subtype === 'Cash') {
          realizedPnL += (t.price || 0);
          cashFlows.push({ amount: (t.price || 0), when: tDate });
        } else {
          currentUnits += ((t.price || 0) / 100) * currentUnits;
        }
      }
    });

    let marketValue = 0, priceLabel = "";
    const findAsset = transactions.find(t => t.name.toUpperCase().trim() === tName);
    const cType = typeof itemOrName === 'object' ? itemOrName.asset_class : findAsset?.asset_class;

    const livePrice = stockPrices[tName] || 0;
    const fxRate = stockPrices['USD_BDT'] || 120;

    if (tName === 'VOO' || tName === 'IAUM') {
      marketValue = currentUnits * livePrice * fxRate;
      priceLabel = livePrice > 0 ? `$${livePrice.toFixed(2)} (৳${fxRate.toFixed(1)})` : "Price Pending";
    } else if (cType === 'Stock') {
      marketValue = currentUnits * livePrice;
      priceLabel = livePrice > 0 ? `LTP: ৳${livePrice.toFixed(2)}` : "Price Pending";
    } else if (cType === 'Mutual Fund') {
      marketValue = currentUnits * livePrice;
      priceLabel = livePrice > 0 ? `NAV: ৳${livePrice.toFixed(3)}` : "Manual Entry Needed";
    } else {
      const isInterest = typeof itemOrName === 'object' ? itemOrName.is_interest_bearing : findAsset?.is_interest_bearing;
      if (isInterest) {
        const years = firstBuyDate ? (new Date() - firstBuyDate) / 31557600000 : 0;
        marketValue = totalCostBasis * Math.pow(1 + (interestRate / 100), years);
        priceLabel = `Accruing: ${interestRate}%`;
      } else {
        marketValue = totalCostBasis;
        priceLabel = "Manual Valuation";
      }
    }

    let individualCAGR = 0;
    try {
      if (cashFlows.length > 0 && marketValue > 0) {
        individualCAGR = (xirr([...cashFlows, { amount: marketValue, when: new Date() }]) * 100).toFixed(2);
      }
    } catch (e) {
      individualCAGR = (((marketValue + realizedPnL - totalCostBasis) / (totalCostBasis || 1)) * 100).toFixed(2);
    }

    return {
      units: currentUnits || 0, marketValue, totalInvested: totalCostBasis, realizedPnL,
      unrealizedPnL: marketValue - totalCostBasis, priceLabel, interestRate,
      avgCost: currentUnits > 0 ? (totalCostBasis / currentUnits) : 0, cagr: individualCAGR || 0, assetClass: cType
    };
  };

  const activeItems = [...new Map(transactions.map(t => [t.name.toUpperCase(), t])).values()];
  const totalInvestedAll = activeItems.reduce((acc, t) => acc + (getStats(t).totalInvested || 0), 0);
  const totalMarketValue = activeItems.reduce((acc, t) => acc + (getStats(t).marketValue || 0), 0);
  const totalRealized = activeItems.reduce((acc, t) => acc + getStats(t).realizedPnL, 0);

  const pieData = [
    { name: 'Stock', value: activeItems.filter(i => getStats(i).assetClass === 'Stock').reduce((acc, i) => acc + getStats(i).marketValue, 0) },
    { name: 'Mutual Fund', value: activeItems.filter(i => getStats(i).assetClass === 'Mutual Fund').reduce((acc, i) => acc + getStats(i).marketValue, 0) },
    { name: 'Others', value: activeItems.filter(i => getStats(i).assetClass === 'Others').reduce((acc, i) => acc + getStats(i).marketValue, 0) }
  ].filter(d => d.value > 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[12px] font-black">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  let portfolioCAGR = '0.00';
  try {
    const allFlows = transactions.map(t => {
      const amt = (t.units || 1) * (t.price || 0);
      if (t.type === 'Buy') return { amount: -amt, when: new Date(t.date) };
      if (t.type === 'Sell' || (t.type === 'Dividend' && t.subtype === 'Cash')) return { amount: amt, when: new Date(t.date) };
      return null;
    }).filter(f => f !== null);
    if (totalMarketValue > 0 && allFlows.length > 0) {
      const result = xirr([...allFlows, { amount: totalMarketValue, when: new Date() }]) * 100;
      portfolioCAGR = result.toFixed(2);
    }
  } catch (e) { portfolioCAGR = '0.00'; }

  useEffect(() => {
    const syncWithDashboard = async () => {
      if (isLoaded && totalMarketValue > 0 && portfolio.id) {
        await supabase.from('portfolios').update({ last_aum: totalMarketValue, last_cagr: parseFloat(portfolioCAGR) }).eq('id', portfolio.id);
      }
    };
    const timer = setTimeout(syncWithDashboard, 2000);
    return () => clearTimeout(timer);
  }, [isLoaded, totalMarketValue, portfolioCAGR, portfolio.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = symbolInput.trim().toUpperCase();
    const stats = getStats(name);
    const units = parseFloat(f.get('units') || 1);
    if (txType === 'Sell' && (stats.units <= 0 || units > stats.units)) { alert("Logic Error: Invalid Sell Qty"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const newTx = {
      portfolio_id: portfolio.id, user_id: user.id, asset_class: assetType, name,
      units: assetType === 'Others' || txType === 'Dividend' ? 1 : units,
      price: parseFloat(f.get('price')), type: txType, subtype: divSubtype, date: f.get('date'),
      is_interest_bearing: assetType === 'Others' ? isInterestBearing : false,
      interest_rate: isInterestBearing ? parseFloat(f.get('interestRate')) : 0
    };
    const { data, error } = await supabase.from('transactions').insert([newTx]).select();
    if (!error) { setTransactions([...transactions, data[0]]); setSymbolInput(''); e.target.reset(); }
  };

  const handleReset = async () => {
    if (prompt("Type 'RESET':") === 'RESET') {
      const { error } = await supabase.from('transactions').delete().eq('portfolio_id', portfolio.id);
      if (!error) {
        setTransactions([]);
        window.location.reload();
      }
    }
  };

  const deleteTransaction = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) setTransactions(transactions.filter(t => t.id !== id));
  };

  const filteredTransactions = transactions.filter(t => t.name.toUpperCase().includes(ledgerFilter.toUpperCase()));
  const totalLedgerItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalLedgerItems / pageSize);
  const paginatedTransactions = [...filteredTransactions].reverse().slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!isLoaded) return <div className="p-20 text-center font-black animate-pulse text-slate-300">CLOUD SYNCING...</div>;

  return (
    <main className="min-h-screen font-sans text-slate-900 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
       
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <button onClick={onBack} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all">← Back to List</button>
          <div className="text-center">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">{portfolio.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Price/NAV Updated at: {lastSync || 'Syncing...'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="bg-slate-50 text-slate-500 border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-50 hover:text-blue-600 transition-all">↑ Excel Export</button>
            <label className="bg-slate-50 text-slate-500 border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-50 hover:text-emerald-600 transition-all cursor-pointer">
              ↓ Excel Import
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400 opacity-70 tracking-widest">Invested</p><h1 className="text-2xl font-black tabular-nums">{formatCurrency(totalInvestedAll)}</h1></div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400 opacity-70 tracking-widest">Current Value</p><h1 className="text-2xl font-black tabular-nums">{formatCurrency(totalMarketValue)}</h1></div>
          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg"><p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Realized P&L</p><h1 className="text-2xl font-black">{formatPNL(totalRealized)}</h1></div>
          <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-lg"><p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Unrealized P&L</p><h1 className="text-2xl font-black">{formatPNL(totalMarketValue - totalInvestedAll)}</h1></div>
          <div className={`p-6 rounded-3xl text-white shadow-xl flex flex-col justify-center transition-all duration-500 ${parseFloat(portfolioCAGR) >= 10 ? 'bg-emerald-600' : parseFloat(portfolioCAGR) >= 5 ? 'bg-amber-500' : 'bg-rose-600'}`}><p className="text-[10px] font-black uppercase opacity-70 text-center tracking-widest">CAGR</p><h1 className="text-4xl font-black italic text-center">{portfolioCAGR}%</h1></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm h-[400px] flex flex-col items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" labelLine={false} label={renderCustomizedLabel}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.name === 'Stock' ? COLORS[0] : e.name === 'Mutual Fund' ? COLORS[1] : COLORS[2]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['Stock', 'Mutual Fund', 'Others'].map(t => <button key={t} type="button" onClick={() => { setAssetType(t); setSymbolInput(''); if(t==='Others') setTxType('Buy'); }} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg ${assetType === t ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>{t}</button>)}
                  </div>
                  <div className="relative" ref={suggestionRef}>
                    <input value={symbolInput} onChange={handleSymbolChange} required placeholder="Asset Ticker" className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold uppercase text-xs" autoComplete="off" />
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border border-slate-100 mt-2 rounded-2xl shadow-2xl overflow-hidden">
                            {suggestions.map(s => <div key={s} onClick={() => { setSymbolInput(s); setShowSuggestions(false); }} className="p-4 hover:bg-blue-50 cursor-pointer font-black text-xs uppercase">{s}</div>)}
                        </div>
                    )}
                  </div>
                  <div className="flex bg-slate-200 p-1 rounded-xl">
                    {['Buy', 'Sell', 'Dividend'].map(t => (assetType !== 'Others' || t !== 'Dividend') && <button key={t} type="button" onClick={() => setTxType(t)} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${txType === t ? (t==='Buy'?'bg-emerald-600':t==='Sell'?'bg-rose-600':'bg-indigo-600') + ' text-white shadow-md' : 'text-slate-500'}`}>{t}</button>)}
                  </div>
                  <input name="date" type="date" max={today} required className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold" />
                  <div className="grid grid-cols-2 gap-2">
                    {txType !== 'Dividend' && <input name="units" type="number" step="any" placeholder="Qty" required className="bg-slate-50 p-4 rounded-2xl font-bold text-xs" />}
                    <input name="price" type="number" step="any" placeholder="Price" required className={`bg-slate-50 p-4 rounded-2xl font-bold text-xs ${txType === 'Dividend' ? 'col-span-2' : ''}`} />
                  </div>
                  <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase hover:bg-blue-600 shadow-lg transition-all">Submit Entry</button>
                </form>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b">
                  <th className="p-8">Asset Name</th>
                  <th className="p-8 text-right">Cost Basis Breakdown</th>
                  <th className="p-8 text-right">Current Value</th>
                  <th className="p-8 text-right w-[140px]">PnL / CAGR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeItems.map(item => {
                  const s = getStats(item);
                  if (s.units <= 0 && s.assetClass !== 'Others') return null;
                  const labelCol = s.assetClass === 'Stock' ? COLORS[0] : s.assetClass === 'Mutual Fund' ? COLORS[1] : COLORS[2];
                  const displayCagr = Number(s.cagr || 0).toFixed(2);
                  return (
                    <tr key={item.name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-8">
                        <span style={{ backgroundColor: `${labelCol}15`, color: labelCol }} className="text-[8px] font-black px-2 py-0.5 rounded uppercase mb-1 inline-block">{s.assetClass}</span>
                        <span className="font-black text-2xl tracking-tighter block uppercase leading-none">{item.name}</span>
                      </td>
                      <td className="p-8 text-right">
                        <div className="font-bold text-slate-900 text-lg">{formatCurrency(s.totalInvested)}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">
                          Qty: {s.units.toFixed(2)} • <span className="text-blue-600">Avg: ৳{s.avgCost.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                        </div>
                      </td>
                      <td className="p-8 text-right">
                        <div className="font-black text-slate-900 text-lg">{formatCurrency(s.marketValue)}</div>
                        <div className="text-[10px] font-black text-blue-600 italic uppercase">{s.priceLabel}</div>
                      </td>
                      <td className={`p-8 text-right font-black text-lg whitespace-nowrap ${s.unrealizedPnL >= 0 ? 'text-green-500' : 'text-rose-500'}`}>
                        {s.unrealizedPnL >= 0 ? '▲' : '▼'} {formatPNL(Math.abs(s.unrealizedPnL))}
                        <br/><span className="text-[10px] text-slate-400">{displayCagr}% CAGR</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden mt-10">
          <div className="p-8 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 border-b">
            <h3 className="font-black text-2xl uppercase text-slate-400 tracking-widest italic">Ledger History</h3>
            <div className="flex gap-4 items-center">
              <input type="text" placeholder="FILTER BY TICKER..." value={ledgerFilter} onChange={(e) => { setLedgerFilter(e.target.value.toUpperCase()); setCurrentPage(1); }} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 ring-blue-500/20" />
              <button onClick={handleReset} className="text-[10px] font-black text-rose-500 uppercase border-2 border-rose-100 px-6 py-2 rounded-full hover:bg-rose-50 transition-all">Reset All</button>
            </div>
          </div>
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 font-black uppercase border-b">
                <th className="p-6">Date</th>
                <th className="p-6">Ticker</th>
                <th className="p-6">Type</th>
                <th className="p-6 text-right">Qty</th>
                <th className="p-6 text-right">Unit Price</th>
                <th className="p-6 text-right">Total Amount</th>
                <th className="p-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 font-bold text-slate-400">{t.date}</td>
                  <td className="p-6 font-black uppercase text-slate-900">{t.name}</td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded-full font-black text-[9px] uppercase ${t.type === 'Buy' ? 'bg-emerald-100 text-emerald-700' : t.type === 'Sell' ? 'bg-red-100 text-red-700' : 'bg-indigo-600 text-white'}`}>
                      {t.type} {t.subtype ? `(${t.subtype})` : ''}
                    </span>
                  </td>
                  <td className="p-6 text-right font-bold text-slate-600">{t.units?.toFixed(2) || '-'}</td>
                  <td className="p-6 text-right font-bold text-slate-600">৳{t.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-6 text-right font-black text-slate-900">৳{((t.units || 1) * (t.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-6 text-center"><button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 text-lg">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <p className="text-[10px] font-black uppercase text-slate-400">Page {currentPage} of {totalPages} ({totalLedgerItems} Records)</p>
              <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${currentPage === 1 ? 'text-slate-300' : 'text-blue-600 bg-white shadow-sm border border-slate-200 hover:bg-blue-50'}`}>Previous</button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${currentPage === totalPages ? 'text-slate-300' : 'text-blue-600 bg-white shadow-sm border border-slate-200 hover:bg-blue-50'}`}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}