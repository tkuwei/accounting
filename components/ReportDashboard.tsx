import React, { useState, useMemo, useEffect } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { FileJson, FileSpreadsheet, Calculator, Info } from 'lucide-react';
import { Transaction, ReportTrendMode } from '../types';
import { EXPENSE_DISTRIBUTION_RULES } from '../constants';

interface ReportDashboardProps {
  transactions: Transaction[];
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1', 
  '#14b8a6', '#d946ef', '#f43f5e',
];

const ReportDashboard: React.FC<ReportDashboardProps> = ({ transactions }) => {
  const [isMounted, setIsMounted] = useState(false);
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();
  
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [trendMode, setTrendMode] = useState<ReportTrendMode>('month');
  const [useSmartDistribution, setUseSmartDistribution] = useState(false);

  useEffect(() => {
    // Delay rendering charts to allow flex/grid layout to settle
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const years = useMemo(() => {
    const uniqueYears = new Set<string>();
    uniqueYears.add(currentYear);
    transactions.forEach(t => {
        const y = t.date.split('-')[0];
        if (y.length === 4) uniqueYears.add(y);
    });
    return Array.from(uniqueYears).sort((a, b) => Number(b) - Number(a));
  }, [transactions, currentYear]);

  const yearData = useMemo(() => transactions.filter(t => t.date.startsWith(year)), [transactions, year]);
  
  const monthData = useMemo(() => yearData.filter(t => {
    const m = new Date(t.date).getMonth() + 1;
    return m === Number(month);
  }), [yearData, month]);

  const calculateStats = (data: Transaction[]) => {
    return data.reduce((acc, t) => {
        if (t.type === '收入') acc.inc += t.amount;
        else acc.exp += t.amount;
        return acc;
    }, { inc: 0, exp: 0, net: 0 });
  };
  
  const getStats = (data: Transaction[]) => {
      const s = calculateStats(data);
      s.net = s.inc - s.exp;
      return s;
  };

  const yearStats = getStats(yearData);
  const monthStats = getStats(monthData);

  const trendData = useMemo(() => {
    if (trendMode === 'month') {
      const statsMap = new Map<number, {inc: number, exp: number}>();
      for(let i=1; i<=12; i++) statsMap.set(i, {inc: 0, exp: 0});
      
      yearData.forEach(t => {
          const m = new Date(t.date).getMonth() + 1;
          const entry = statsMap.get(m)!;
          if(t.type === '收入') entry.inc += t.amount;
          else entry.exp += t.amount;
      });

      return Array.from(statsMap.entries()).map(([m, val]) => ({
          name: `${m}月`,
          inc: val.inc,
          exp: val.exp,
          net: val.inc - val.exp
      }));

    } else if (trendMode === 'week') {
      const weeks = new Array(53).fill(0).map((_, i) => ({ name: `W${i + 1}`, inc: 0, exp: 0, net: 0 }));
      const startOfYear = new Date(Number(year), 0, 1);
      
      yearData.forEach(t => {
        const d = new Date(t.date);
        const days = Math.floor((d.getTime() - startOfYear.getTime()) / (86400000));
        const weekIdx = Math.min(Math.floor(days / 7), 52);
        
        if (t.type === '收入') weeks[weekIdx].inc += t.amount;
        else weeks[weekIdx].exp += t.amount;
      });
      
      return weeks.map(w => ({ ...w, net: w.inc - w.exp }));

    } else {
      // --- DAILY MODE LOGIC ---
      const daysInYear = ((Number(year) % 4 === 0 && Number(year) % 100 > 0) || Number(year) % 400 === 0) ? 366 : 365;
      const data = [];
      const curr = new Date(Number(year), 0, 1);
      
      // We process month by month to apply smart distribution correctly per month
      // Or if viewing whole year in day mode (which is heavy), we process linear.
      // But usually "day" mode in year view is too crowded. 
      // Current logic processes the whole year. Let's keep it simple.
      
      // 1. Organize data by date
      const dayMap = new Map<string, {inc: number, exp: number, directExp: number}>();
      
      // If Smart Distribution is ON, we need to bucket costs first
      const monthlyPools = new Map<string, { totalInc: number, fixedExp: number, weightedExp: number, days: number }>();

      if (useSmartDistribution) {
         // Pre-calculate monthly pools
         for(let i=1; i<=12; i++) {
             const daysInMonth = new Date(Number(year), i, 0).getDate();
             monthlyPools.set(`${year}-${String(i).padStart(2, '0')}`, { totalInc: 0, fixedExp: 0, weightedExp: 0, days: daysInMonth });
         }

         yearData.forEach(t => {
            const monthKey = t.date.substring(0, 7); // YYYY-MM
            const pool = monthlyPools.get(monthKey);
            if (!pool) return;

            if (t.type === '收入') {
                pool.totalInc += t.amount;
            } else {
                if (EXPENSE_DISTRIBUTION_RULES.FIXED.includes(t.category)) {
                    pool.fixedExp += t.amount;
                } else if (EXPENSE_DISTRIBUTION_RULES.WEIGHTED.includes(t.category)) {
                    pool.weightedExp += t.amount;
                }
                // Direct expenses are handled in the day loop below, 
                // but we shouldn't double count if we are distributing.
                // So if it's fixed or weighted, we DON'T add it to direct day map later?
                // Wait, logic needs to be clean.
            }
         });
      }

      // Initialize Map
      for(let i=0; i<daysInYear; i++) {
         const dateStr = curr.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
         dayMap.set(dateStr, { inc: 0, exp: 0, directExp: 0 });
         curr.setDate(curr.getDate() + 1);
      }

      // 2. Fill Data
      yearData.forEach(t => {
          const entry = dayMap.get(t.date);
          if (!entry) return;

          if (t.type === '收入') {
              entry.inc += t.amount;
          } else {
              // Expense Logic
              if (useSmartDistribution) {
                  // Only add to 'directExp' if it is NOT in the pools
                  const isFixed = EXPENSE_DISTRIBUTION_RULES.FIXED.includes(t.category);
                  const isWeighted = EXPENSE_DISTRIBUTION_RULES.WEIGHTED.includes(t.category);
                  
                  if (!isFixed && !isWeighted) {
                      entry.directExp += t.amount;
                  }
              } else {
                  // Standard mode: everything is direct
                  entry.exp += t.amount;
              }
          }
      });

      // 3. Final Construction
      const resultData = [];
      const iterateDate = new Date(Number(year), 0, 1);
      
      for(let i=0; i<daysInYear; i++) {
        const dateStr = iterateDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
        const monthKey = dateStr.substring(0, 7);
        const stats = dayMap.get(dateStr)!;

        let finalExp = stats.exp; // Default mode value

        if (useSmartDistribution) {
            const pool = monthlyPools.get(monthKey);
            if (pool) {
                // 1. Fixed Cost Share = Total Fixed / Days in Month
                const fixedShare = Math.round(pool.fixedExp / pool.days);
                
                // 2. Weighted Cost Share = Total Weighted * (Daily Inc / Monthly Inc)
                let weightedShare = 0;
                if (pool.totalInc > 0) {
                    weightedShare = Math.round(pool.weightedExp * (stats.inc / pool.totalInc));
                } else {
                    // If no income whole month (unlikely), split equally or 0? 
                    // Let's do 0 for revenue-based cost, as you didn't produce.
                    weightedShare = 0;
                }
                
                finalExp = stats.directExp + fixedShare + weightedShare;
            }
        }
        
        resultData.push({ 
            name: `${iterateDate.getMonth()+1}/${iterateDate.getDate()}`, 
            fullDate: dateStr, 
            inc: stats.inc,
            exp: finalExp,
            net: stats.inc - finalExp
        });
        iterateDate.setDate(iterateDate.getDate() + 1);
      }
      return resultData;
    }
  }, [yearData, trendMode, year, useSmartDistribution]);

  // Aggregates expenses by category
  const getProcessedExpenseData = (data: Transaction[]) => {
    const catMap = new Map<string, number>();
    
    data.forEach(t => {
        if (t.type !== '支出') return;
        
        let key = t.category;
        catMap.set(key, (catMap.get(key) || 0) + t.amount);
    });

    return Array.from(catMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  };

  // Aggregates INCOME by category (Sources of Income)
  const getIncomeSourceData = (data: Transaction[]) => {
    const catMap = new Map<string, number>();
    
    data.forEach(t => {
        if (t.type !== '收入') return;
        
        const key = t.category;
        catMap.set(key, (catMap.get(key) || 0) + t.amount);
    });

    return Array.from(catMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  };

  const chartsData = [
    { title: `收入來源分析`, data: getIncomeSourceData(yearData), sub: `${year}年` },
    { title: `成本結構分析`, data: getProcessedExpenseData(yearData), sub: `${year}年` },
    { title: `收入來源分析`, data: getIncomeSourceData(monthData), sub: `${month}月` },
    { title: `成本結構分析`, data: getProcessedExpenseData(monthData), sub: `${month}月` },
  ];

  const handleExport = (type: 'csv' | 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `financial_data_${timestamp}`;
    
    if (type === 'json') {
      const dataStr = JSON.stringify(transactions, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', '日期', '類型', '類別', '金額', '備註'];
      const rows = transactions.map(t => [
        t.id,
        t.date,
        t.type,
        t.category,
        t.amount,
        `"${(t.note || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const StatCard = ({ title, value, colorClass }: { title: string; value: number; colorClass: string }) => (
    <div className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 border transition-all ${colorClass}`}>
      <p className="text-sm font-bold opacity-80 shrink-0">{title}</p>
      <p className="text-lg font-black tracking-tight truncate">${value.toLocaleString()}</p>
    </div>
  );

  const SectionHeader = ({ title, sub }: { title: string, sub?: string }) => (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
        {title}
      </h3>
      {sub && <span className="text-[10px] font-bold text-slate-400">{sub}</span>}
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-orange-50 p-3 rounded-2xl shadow-sm border border-orange-100 flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-orange-100">
            <span className="font-bold text-slate-400 text-xs">年份</span>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent font-bold outline-none text-slate-700 text-sm">
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-orange-100">
            <span className="font-bold text-slate-400 text-xs">月份</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent font-bold outline-none text-slate-700 text-sm">
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg border border-orange-100">
            <span className="font-bold text-slate-400 text-xs mr-1">匯出</span>
            <button 
              onClick={() => handleExport('csv')} 
              className="p-1 hover:bg-green-50 text-slate-500 hover:text-green-600 rounded transition-colors"
              title="匯出 CSV"
            >
              <FileSpreadsheet size={16} />
            </button>
            <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
            <button 
              onClick={() => handleExport('json')} 
              className="p-1 hover:bg-orange-50 text-slate-500 hover:text-orange-600 rounded transition-colors"
              title="匯出 JSON"
            >
              <FileJson size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {/* Smart Distribution Toggle */}
            <button
                onClick={() => setUseSmartDistribution(!useSmartDistribution)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    useSmartDistribution 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200' 
                    : 'bg-white text-slate-500 border-orange-100 hover:bg-purple-50'
                }`}
                title="啟用後：固定支出將平均分攤到每日，食材耗材將依營業額權重分攤"
            >
                <Calculator size={14} />
                {useSmartDistribution ? '智能成本分攤 ON' : '智能成本分攤 OFF'}
            </button>

            <div className="flex bg-white p-1 rounded-lg border border-orange-100 flex-1 xl:flex-none">
            {(['month', 'week', 'day'] as ReportTrendMode[]).map(m => (
                <button key={m} onClick={() => setTrendMode(m)} className={`flex-1 xl:flex-none px-3 py-1 rounded-md font-bold text-xs transition-all ${trendMode === m ? 'bg-orange-500 shadow-sm text-white' : 'text-slate-400'}`}>
                {m === 'month' ? '月線' : m === 'week' ? '週線' : '日線'}
                </button>
            ))}
            </div>
        </div>
      </div>
      
      {/* Helper Text for Smart Distribution */}
      {useSmartDistribution && trendMode === 'day' && (
          <div className="bg-purple-50 border border-purple-100 px-4 py-2 rounded-xl flex items-start gap-2 text-xs text-purple-800 animate-bounce-in">
              <Info size={16} className="shrink-0 mt-0.5" />
              <div>
                  <span className="font-bold">智能分攤模式已啟用：</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 opacity-80">
                      <li>房租、水電、月薪等固定支出，已平均分攤至每一天。</li>
                      <li>食材、耗材等浮動成本，已依照「當日營收佔比」加權分攤（營收越高分攤越多）。</li>
                      <li>外送抽成、日薪等維持在實際發生日。</li>
                  </ul>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-orange-50 p-4 rounded-3xl shadow-sm border border-orange-100 w-full min-w-0 flex flex-col">
          <SectionHeader title={trendMode === 'day' ? "每日損益趨勢 (含分攤)" : "趨勢分析"} />
          <div className="w-full h-[240px] mt-auto overflow-hidden relative">
            {isMounted ? (
              <div style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={200}>
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      tick={{fontSize: 10}} 
                      interval={trendMode === 'day' ? 'preserveStartEnd' : 0} 
                      axisLine={false} 
                      tickLine={false} 
                      dy={5}
                    />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="inc" name="收入" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="exp" name={useSmartDistribution && trendMode === 'day' ? "分攤後成本" : "支出"} fill="#f87171" radius={[4, 4, 0, 0]} barSize={16} />
                    <Line type="monotone" dataKey="net" name="營利" stroke="#3b82f6" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div className="w-full h-full rounded-xl bg-orange-100/50 animate-pulse flex items-center justify-center text-orange-300 text-xs">載入中...</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-orange-50 p-4 rounded-3xl shadow-sm border border-orange-100 flex flex-col justify-start gap-3">
          <div className="space-y-2">
            <SectionHeader title="年度經營概況" sub={`${year}年`} />
            <div className="grid grid-cols-1 gap-2">
              <StatCard title="年收入" value={yearStats.inc} colorClass="bg-white text-green-700 border-green-50" />
              <StatCard title="年支出" value={yearStats.exp} colorClass="bg-white text-red-700 border-red-50" />
              <StatCard title="年營利" value={yearStats.net} colorClass="bg-white text-blue-700 border-blue-50" />
            </div>
          </div>
          
          <div className="space-y-2">
            <SectionHeader title="本月損益概況" sub={`${month}月`} />
            <div className="grid grid-cols-1 gap-2">
              <StatCard title="月收入" value={monthStats.inc} colorClass="bg-white text-green-700 border-green-50" />
              <StatCard title="月支出" value={monthStats.exp} colorClass="bg-white text-red-700 border-red-50" />
              <StatCard title="月營利" value={monthStats.net} colorClass="bg-blue-600 text-white shadow-lg shadow-blue-100 border-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chartsData.map((chart, idx) => {
          const totalValue = chart.data.reduce((sum, item) => sum + item.value, 0);
          return (
            <div key={idx} className="bg-orange-50 p-4 rounded-3xl shadow-sm border border-orange-100 flex flex-col w-full min-w-0">
              <SectionHeader title={chart.title} sub={chart.sub} />
              <div className="w-full h-[180px] overflow-hidden relative">
                {isMounted && chart.data.length > 0 ? (
                  <div style={{ width: '100%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={200}>
                      <PieChart>
                        <Pie data={chart.data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                          {chart.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [`$${value.toLocaleString()} (${totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0'}%)`, name]}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{fontSize: '10px', bottom: 0}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">
                    {isMounted ? '無數據' : '載入中...'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReportDashboard;