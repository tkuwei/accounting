import React from 'react';
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

  return (
    <div className="bg-white p-5 rounded-3xl shadow-lg border border-slate-100">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => onMonthChange(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800">
           ←
        </button>
        <h2 className="text-lg font-black text-slate-700">
          {year}年 {month + 1}月
        </h2>
        <button onClick={() => onMonthChange(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800">
          →
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-[10px] font-bold text-slate-300 pb-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {emptyDays.map(i => <div key={`empty-${i}`} />)}
        {daysArray.map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasData = transactions.some(r => r.date === dateStr);
          const isSelected = selectedDate === dateStr;
          
          let btnClass = "aspect-[1/1.1] flex flex-col items-center justify-center rounded-xl text-sm transition-all cursor-pointer border ";
          
          if (isSelected) {
            btnClass += "border-orange-400 bg-orange-50 text-orange-600 font-bold ring-2 ring-orange-200 transform scale-105 shadow-md";
          } else if (hasData) {
            btnClass += "border-transparent bg-green-50 text-green-700 font-bold hover:bg-green-100";
          } else {
            btnClass += "border-slate-50 bg-white text-slate-500 hover:bg-slate-50";
          }

          return (
            <div 
              key={day} 
              onClick={() => onSelectDate(dateStr)}
              className={btnClass}
            >
              {day}
              {hasData && !isSelected && <div className="w-1 h-1 bg-green-500 rounded-full mt-1"></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;