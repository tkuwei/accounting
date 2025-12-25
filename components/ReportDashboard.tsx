import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Transaction, ReportTrendMode } from '../types';

interface ReportDashboardProps {
  transactions: Transaction[];
}

// Diverse palette for expenses (excluding the specific Blue used for Profit)
const EXPENSE_COLORS = [
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
];

const PROFIT_COLOR = '#3b82f6'; // Blue 500 (Distinct from expense colors)

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

  // Shared Helper: Process expenses into Cost Structure format
  const getProcessedExpenseData = (data: Transaction[]) => {
    const expenses = data.filter(t => t.type === '支出');
    const catMap: Record<string, number> = {};
    
    expenses.forEach(t => {
      let key = t.category;
      
      // Logic: Merge all salary types into one
      if (key.includes('薪資')) {
        key = '薪資總計';
      }
      // Logic: Merge Cleaning, Repair, and Misc into '雜支'
      else if (['清潔維護費', '維修', '雜項'].includes(key)) {
        key = '雜支';
      }
      
      catMap[key] = (catMap[key] || 0) + t.amount;
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  // Income Composition: Net Profit + Expense Breakdown (Cost Structure style)
  const getIncomeCompositionData = (data: Transaction[]) => {
    const stats = calculateStats(data);
    if (stats.inc === 0 && stats.exp === 0) return [];

    const expenseBreakdown = getProcessedExpenseData(data);

    // If there is profit, add it as a slice
    if (stats.net > 0) {
      return [{ name: '淨利', value: stats.net }, ...expenseBreakdown];
    }

    // If loss or break-even, just show expenses
    return expenseBreakdown;
  };

  // Cost Structure: Just Expense Breakdown
  const getCostData = (data: Transaction[]) => {
    return getProcessedExpenseData(data);
  };

  const chartsData = [
    { title: `${year}年 收入分配`, data: getIncomeCompositionData(yearData), isIncomeDist: true },
    { title: `${year}年 成本結構`, data: getCostData(yearData), isIncomeDist: false },
    { title: `${month}月 收入分配`, data: getIncomeCompositionData(monthData), isIncomeDist: true },
    { title: `${month}月 成本結構`, data: getCostData(monthData), isIncomeDist: false },
  ];

  const StatCard = ({ title, value, colorClass }: { title: string; value: number; colorClass: string }) => (
    <div className={`p-3 rounded-xl text-center ${colorClass}`}>
      <p className="text-[10px] uppercase font-bold opacity-70 mb-1">{title}</p>
      <p className="text-sm md:text-lg font-black tracking-tight">${value.toLocaleString()}</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Controls */}
      <div className="bg-orange-50 p-5 rounded-3xl shadow-sm border border-orange-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-orange-100">
            <span className="font-bold text-slate-400 text-xs">年份</span>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent font-black outline-none text-slate-700">
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-orange-100">
            <span className="font-bold text-slate-400 text-xs">月份</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent font-black outline-none text-slate-700">
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl w-full md:w-auto border border-orange-100">
          {(['month', 'week', 'day'] as ReportTrendMode[]).map(m => (
             <button 
               key={m}
               onClick={() => setTrendMode(m)}
               className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                 trendMode === m ? 'bg-orange-500 shadow-sm text-white' : 'text-slate-400'
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
        <div className="lg:col-span-2 bg-orange-50 p-6 rounded-3xl shadow-sm border border-orange-100 min-w-0">
          <h3 className="text-lg font-black text-slate-700 mb-6 flex items-center gap-2">
             <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
             年度趨勢分析
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
        <div className="bg-orange-50 p-6 rounded-3xl shadow-sm border border-orange-100 flex flex-col justify-center gap-6">
          <div>
            <p className="text-center text-xs font-bold text-slate-400 mb-3 pb-2 border-b border-orange-100">{year}年 年度經營概況</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard title="年收入" value={yearStats.inc} colorClass="bg-white text-green-700 border border-green-100" />
              <StatCard title="年支出" value={yearStats.exp} colorClass="bg-white text-red-700 border border-red-100" />
              <StatCard title="年營利" value={yearStats.net} colorClass="bg-white text-blue-700 border border-blue-100" />
            </div>
          </div>
          <div>
            <p className="text-center text-xs font-bold text-slate-400 mb-3 pb-2 border-b border-orange-100">{month}月 本月損益</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard title="月收入" value={monthStats.inc} colorClass="bg-white text-green-700 border border-green-100" />
              <StatCard title="月支出" value={monthStats.exp} colorClass="bg-white text-red-700 border border-red-100" />
              <StatCard title="月營利" value={monthStats.net} colorClass="bg-blue-600 text-white shadow-md shadow-blue-200" />
            </div>
          </div>
        </div>
      </div>

      {/* 2x2 Pie Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {chartsData.map((chart, idx) => {
          const totalValue = chart.data.reduce((sum, item) => sum + item.value, 0);

          return (
            <div key={idx} className="bg-orange-50 p-4 rounded-3xl shadow-sm border border-orange-100 flex flex-col min-w-0">
              <h4 className="text-xs font-bold text-slate-500 mb-4 text-center">{chart.title}</h4>
              <div className="w-full h-[220px]">
                {chart.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                        {chart.data.map((entry, index) => {
                          let fill;
                          
                          if (entry.name === '淨利') {
                            fill = PROFIT_COLOR;
                          } else {
                            // Assign color from EXPENSE_COLORS based on index
                            // If '淨利' exists at index 0, we want stable colors for expenses.
                            // However, simplest is just to cycle through expense colors.
                            // If we want consistency between charts, we could hash the name to an index, but index cycle is visually cleaner.
                            
                            // Adjust index if Net Profit is present so expenses always start from same color
                            const expenseIndex = chart.isIncomeDist && chart.data[0].name === '淨利' 
                                ? index - 1 
                                : index;
                                
                            fill = EXPENSE_COLORS[expenseIndex % EXPENSE_COLORS.length];
                          }

                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          const percent = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0';
                          return [`$${value.toLocaleString()} (${percent}%)`, name];
                        }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">無數據</div>
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