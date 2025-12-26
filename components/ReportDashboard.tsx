import React, { useState, useMemo, useEffect } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { FileJson, FileSpreadsheet } from 'lucide-react';
import { Transaction, ReportTrendMode } from '../types';

interface ReportDashboardProps {
  transactions: Transaction[];
}

const EXPENSE_COLORS = [
  '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6', 
  '#d946ef', '#f43f5e',
];

const PROFIT_COLOR = '#3b82f6';

const ReportDashboard: React.FC<ReportDashboardProps> = ({ transactions }) => {
  const [isMounted, setIsMounted] = useState(false);
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();
  
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [trendMode, setTrendMode] = useState<ReportTrendMode>('month');

  useEffect(() => {
    // Delay rendering charts to allow flex/grid layout to settle
    const timer = setTimeout(() => setIsMounted(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const years = useMemo(() => {
    // Optimization: Calculate unique years efficiently
    const uniqueYears = new Set<string>();
    uniqueYears.add(currentYear);
    transactions.forEach(t => {
        const y = t.date.split('-')[0];
        if (y.length === 4) uniqueYears.add(y);
    });
    return Array.from(uniqueYears).sort((a, b) => Number(b) - Number(a));
  }, [transactions, currentYear]);

  // Filter optimization: Filter Year Data once
  const yearData = useMemo(() => transactions.filter(t => t.date.startsWith(year)), [transactions, year]);
  
  // Filter optimization: Filter Month Data from the smaller yearData subset
  const monthData = useMemo(() => yearData.filter(t => {
    const m = new Date(t.date).getMonth() + 1;
    return m === Number(month);
  }), [yearData, month]);

  const calculateStats = (data: Transaction[]) => {
    // Single pass reduction is efficiently O(N)
    return data.reduce((acc, t) => {
        if (t.type === '收入') acc.inc += t.amount;
        else acc.exp += t.amount;
        return acc;
    }, { inc: 0, exp: 0, net: 0 });
  };
  
  // Wrapper to add net to the result
  const getStats = (data: Transaction[]) => {
      const s = calculateStats(data);
      s.net = s.inc - s.exp;
      return s;
  };

  const yearStats = getStats(yearData);
  const monthStats = getStats(monthData);

  const trendData = useMemo(() => {
    // ALGORITHM OPTIMIZATION: 
    // Use Hash Maps for aggregation to avoid nested loops. 
    // Reduces complexity from O(Items * TimeUnits) to O(Items).
    
    if (trendMode === 'month') {
      const statsMap = new Map<number, {inc: number, exp: number}>();
      // Initialize map
      for(let i=1; i<=12; i++) statsMap.set(i, {inc: 0, exp: 0});
      
      // Single pass through data
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
      // Create buckets for 53 weeks
      const weeks = new Array(53).fill(0).map((_, i) => ({ name: `W${i + 1}`, inc: 0, exp: 0, net: 0 }));
      const startOfYear = new Date(Number(year), 0, 1);
      
      yearData.forEach(t => {
        const d = new Date(t.date);
        const days = Math.floor((d.getTime() - startOfYear.getTime()) / (86400000));
        const weekIdx = Math.min(Math.floor(days / 7), 52);
        
        if (t.type === '收入') weeks[weekIdx].inc += t.amount;
        else weeks[weekIdx].exp += t.amount;
      });
      
      // Calculate Net and filter out empty tail weeks if wanted (optional, keeping all for scale)
      return weeks.map(w => ({ ...w, net: w.inc - w.exp }));

    } else {
      // Day Mode - Heavy Optimization needed here
      const daysInYear = ((Number(year) % 4 === 0 && Number(year) % 100 > 0) || Number(year) % 400 === 0) ? 366 : 365;
      const data = [];
      const curr = new Date(Number(year), 0, 1);
      
      // 1. Build a fast lookup map
      const dayMap = new Map<string, {inc: number, exp: number}>();
      yearData.forEach(t => {
          if (!dayMap.has(t.date)) dayMap.set(t.date, { inc: 0, exp: 0 });
          const entry = dayMap.get(t.date)!;
          if (t.type === '收入') entry.inc += t.amount;
          else entry.exp += t.amount;
      });

      // 2. Build the timeline using the map
      for(let i=0; i<daysInYear; i++) {
        // Use sv-SE for consistent YYYY-MM-DD format
        const dateStr = curr.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
        const stats = dayMap.get(dateStr) || { inc: 0, exp: 0 };
        
        data.push({ 
            name: `${curr.getMonth()+1}/${curr.getDate()}`, 
            fullDate: dateStr, 
            inc: stats.inc,
            exp: stats.exp,
            net: stats.inc - stats.exp
        });
        curr.setDate(curr.getDate() + 1);
      }
      return data;
    }
  }, [yearData, trendMode, year]);

  const getProcessedExpenseData = (data: Transaction[]) => {
    // Optimization: use Map for category aggregation
    const catMap = new Map<string, number>();
    
    data.forEach(t => {
        if (t.type !== '支出') return;
        
        let key = t.category;
        if (key.includes('薪資')) key = '薪資總計';
        else if (['清潔維護費', '維修', '雜項'].includes(key)) key = '雜支';
        
        catMap.set(key, (catMap.get(key) || 0) + t.amount);
    });

    return Array.from(catMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  };

  const getIncomeCompositionData = (data: Transaction[]) => {
    const stats = getStats(data);
    if (stats.inc === 0 && stats.exp === 0) return [];
    const expenseBreakdown = getProcessedExpenseData(data);
    if (stats.net > 0) return [{ name: '淨利', value: stats.net }, ...expenseBreakdown];
    return expenseBreakdown;
  };

  const chartsData = [
    { title: `收入分配`, data: getIncomeCompositionData(yearData), isIncomeDist: true, sub: `${year}年` },
    { title: `成本結構`, data: getProcessedExpenseData(yearData), isIncomeDist: false, sub: `${year}年` },
    { title: `收入分配`, data: getIncomeCompositionData(monthData), isIncomeDist: true, sub: `${month}月` },
    { title: `成本結構`, data: getProcessedExpenseData(monthData), isIncomeDist: false, sub: `${month}月` },
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
      <div className="bg-orange-50 p-3 rounded-2xl shadow-sm border border-orange-100 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
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

        <div className="flex bg-white p-1 rounded-lg w-full md:w-auto border border-orange-100">
          {(['month', 'week', 'day'] as ReportTrendMode[]).map(m => (
             <button key={m} onClick={() => setTrendMode(m)} className={`flex-1 md:flex-none px-3 py-1 rounded-md font-bold text-xs transition-all ${trendMode === m ? 'bg-orange-500 shadow-sm text-white' : 'text-slate-400'}`}>
               {m === 'month' ? '月線' : m === 'week' ? '週線' : '日線'}
             </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-orange-50 p-4 rounded-3xl shadow-sm border border-orange-100 w-full min-w-0 flex flex-col">
          <SectionHeader title="年度趨勢分析" />
          <div className="w-full relative h-[240px] mt-auto">
            {isMounted ? (
              <div style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      tick={{fontSize: 10}} 
                      interval={trendMode === 'day' ? 30 : (trendMode === 'week' ? 4 : 0)} 
                      axisLine={false} 
                      tickLine={false} 
                      dy={5}
                    />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="inc" name="收入" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="exp" name="支出" fill="#f87171" radius={[4, 4, 0, 0]} barSize={16} />
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
              <div className="w-full relative h-[180px]">
                {isMounted && chart.data.length > 0 ? (
                  <div style={{ width: '100%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie data={chart.data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value">
                          {chart.data.map((entry, index) => {
                            let fill = entry.name === '淨利' ? PROFIT_COLOR : EXPENSE_COLORS[(chart.isIncomeDist && chart.data[0].name === '淨利' ? index - 1 : index) % EXPENSE_COLORS.length];
                            return <Cell key={`cell-${index}`} fill={fill} />;
                          })}
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