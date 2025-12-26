import React, { useMemo } from 'react';
import { Transaction } from '../types';

interface CalendarProps {
  viewDate: Date;
  selectedDate: string;
  transactions: Transaction[];
  onSelectDate: (date: string) => void;
  onMonthChange: (diff: number) => void;
}

const Calendar: React.FC<CalendarProps> = ({ viewDate, selectedDate, transactions, onSelectDate, onMonthChange }) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  // Performance Optimization: 
  // Create a Set of dates that have transactions for O(1) lookup complexity.
  // This prevents the app from slowing down as the transaction history grows (e.g. 10k+ records).
  const hasDataMap = useMemo(() => {
    // Only look at transactions in the current viewing month/year to further optimize
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const activeDates = new Set<string>();
    
    // We iterate through transactions once, which is much faster than .some() inside the render loop
    for (const t of transactions) {
      if (t.date.startsWith(prefix)) {
        activeDates.add(t.date);
      }
    }
    return activeDates;
  }, [transactions, year, month]);

  return (
    <div className="bg-orange-50 p-5 rounded-3xl shadow-lg border border-orange-100">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => onMonthChange(-1)} className="p-2 hover:bg-orange-100 rounded-full transition-colors text-slate-400 hover:text-slate-800">
           ←
        </button>
        <h2 className="text-2xl font-black text-slate-700">
          {year}年 {month + 1}月
        </h2>
        <button onClick={() => onMonthChange(1)} className="p-2 hover:bg-orange-100 rounded-full transition-colors text-slate-400 hover:text-slate-800">
          →
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-sm font-bold text-slate-400 pb-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {emptyDays.map(i => <div key={`empty-${i}`} />)}
        {daysArray.map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // O(1) Lookup
          const hasData = hasDataMap.has(dateStr);
          const isSelected = selectedDate === dateStr;
          
          let btnClass = "aspect-[1/1.1] flex flex-col items-center justify-center rounded-xl text-lg transition-all cursor-pointer border ";
          
          if (isSelected) {
            btnClass += "border-orange-400 bg-white text-orange-600 font-bold ring-2 ring-orange-200 transform scale-105 shadow-md";
          } else if (hasData) {
            btnClass += "border-transparent bg-green-100 text-green-700 font-bold hover:bg-green-200";
          } else {
            btnClass += "border-transparent bg-white text-slate-500 hover:bg-slate-50";
          }

          return (
            <div 
              key={day} 
              onClick={() => onSelectDate(dateStr)}
              className={btnClass}
            >
              {day}
              {hasData && !isSelected && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1"></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;