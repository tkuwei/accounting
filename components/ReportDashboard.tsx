import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Transaction, ReportTrendMode } from '../types';

interface ReportDashboardProps {
  transactions: Transaction[];
}

const COLORS = ['#22c55e', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];

const ReportDashboard: React.FC<ReportDashboardProps> = ({ transactions }) => {
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();
  
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [trendMode, setTrendMode] = useState<ReportTrendMode>('month');

  // Generate Year Options
  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(transactions.map(t => t.date.split('-')[0])))
      .filter(y => !isNaN(Number(y)) && y.length === 4);
    if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
    return uniqueYears.sort((a, b) => Number(b) - Number(a));
  }, [transactions, currentYear]);

  // Filter Data
  const yearData = useMemo(() => transactions.filter(t => t.date.startsWith(year)), [transactions, year]);
  const monthData = useMemo(() => yearData.filter(t => {
    const m = new Date(t.date).getMonth() + 1;
    return m === Number(month);
  }), [yearData, month]);

  // Calculate Statistics
  const calculateStats = (data: Transaction[]) => {
    const inc = data.filter(t => t.type === '收入').reduce((sum, t) => sum + t.amount, 0);
    const exp = data.filter(t => t.type === '支出').reduce((sum, t) => sum + t.amount, 0);
    return { inc, exp, net: inc - exp };
  };

  const yearStats = calculateStats(yearData);
  const monthStats = calculateStats(monthData);

  // Prepare Trend Data
  const trendData = useMemo(() => {
    if (trendMode === 'month') {
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const items = yearData.filter(t => new Date(t.date).getMonth() + 1 === m);
        const stats = calculateStats(items);
        return { name: `${m}月`, ...stats };
      });
    } else if (trendMode === 'week') {
      const weeks = new Array(52).fill(0).map((_, i) => ({ name: `W${i + 1}`, inc: 0, exp: 0, net: 0 }));
      yearData.forEach(t => {
        const d = new Date(t.date);
        const start = new Date(Number(year), 0, 1);
        const days = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        const weekIdx = Math.min(Math.floor(days / 7), 51);
        if (t.type === '收入') weeks[weekIdx].inc += t.amount;
        else weeks[weekIdx].exp += t.amount;
      });
      return weeks.map(w => ({ ...w, net: w.inc - w.exp }));
    } else {
      // Day Mode
      // Simply map data for every day of the year
      const daysInYear = ((Number(year) % 4 === 0 && Number(year) % 100 > 0) || Number(year) % 400 === 0) ? 366 : 365;
      const data = [];
      const curr = new Date(Number(year), 0, 1);
      
      for(let i=0; i<daysInYear; i++) {
        const dateStr = curr.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
        const dayItems = yearData.filter(t => t.date === dateStr);
        const stats = calculateStats(dayItems);
        data.push({ 
            name: `${curr.getMonth()+1}/${curr.getDate()}`, 
            fullDate: dateStr,
            ...stats 
        });
        curr.setDate(curr.getDate() + 1);
      }
      return data;
    }
  }, [yearData, trendMode, year]);

  // Pie Data Helpers
  const getRatioData = (data: Transaction[]) => {
    const stats = calculateStats(data);
    if (stats.inc === 0 && stats.exp === 0) return [];
    return [
      { name: '總收入', value: stats.inc },
      { name: '總支出', value: stats.exp }
    ];
  };

  const getCostData = (data: Transaction[]) => {
    const expenses = data.filter(t => t.type === '支出');
    const catMap: Record<string, number> = {};
    expenses.forEach(t => {
      let cat = t.category;
      if (cat.includes('薪資')) cat = '薪資';
      catMap[cat] = (catMap[cat] || 0) + t.amount;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const yearRatioData = getRatioData(yearData);
  const yearCostData = getCostData(yearData);
  const monthRatioData = getRatioData(monthData);
  const monthCostData = getCostData(monthData);

  const StatCard = ({ title, value, colorClass }: { title: string; value: number; colorClass: string }) => (
    <div className={`p-3 rounded-xl text-center ${colorClass}`}>
      <p className="text-[10px] uppercase font-bold opacity-70 mb-1">{title}</p>
      <p className="text-sm md:text-lg font-black tracking-tight">${value.toLocaleString()}</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Controls */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
            <span className="font-bold text-slate-400 text-xs">年份</span>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent font-black outline-none text-slate-700">
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
            <span className="font-bold text-slate-400 text-xs">月份</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent font-black outline-none text-slate-700">
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          {(['month', 'week', 'day'] as ReportTrendMode[]).map(m => (
             <button 
               key={m}
               onClick={() => setTrendMode(m)}
               className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                 trendMode === m ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'
               }`}
             >
               {m === 'month' ? '月線' : m === 'week' ? '週線' : '日線'}
             </button>
          ))}
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-700 mb-6 flex items-center gap-2">
             <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
             年度趨勢分析
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 10}} 
                    interval={trendMode === 'day' ? 30 : 0} 
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                />
                <Bar dataKey="inc" name="收入" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="exp" name="支出" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="net" name="營利" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center gap-6">
          <div>
            <p className="text-center text-xs font-bold text-slate-400 mb-3 pb-2 border-b border-slate-100">{year}年 年度經營概況</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard title="年收入" value={yearStats.inc} colorClass="bg-green-50 text-green-700" />
              <StatCard title="年支出" value={yearStats.exp} colorClass="bg-red-50 text-red-700" />
              <StatCard title="年營利" value={yearStats.net} colorClass="bg-blue-50 text-blue-700" />
            </div>
          </div>
          <div>
            <p className="text-center text-xs font-bold text-slate-400 mb-3 pb-2 border-b border-slate-100">{month}月 本月損益</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard title="月收入" value={monthStats.inc} colorClass="bg-green-50 text-green-700" />
              <StatCard title="月支出" value={monthStats.exp} colorClass="bg-red-50 text-red-700" />
              <StatCard title="月營利" value={monthStats.net} colorClass="bg-blue-600 text-white shadow-md shadow-blue-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Pie Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "年度 收支比", data: yearRatioData, isCost: false },
          { title: "年度 成本結構", data: yearCostData, isCost: true },
          { title: "本月 收支比", data: monthRatioData, isCost: false },
          { title: "本月 成本結構", data: monthCostData, isCost: true },
        ].map((chart, idx) => (
          <div key={idx} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
            <h4 className="text-xs font-bold text-slate-500 mb-4">{chart.title}</h4>
            <div className="w-full h-[200px]">
              {chart.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chart.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chart.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chart.isCost ? COLORS[index % COLORS.length] : (entry.name === '總收入' ? '#22c55e' : '#ef4444')} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 text-xs">無數據</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportDashboard;