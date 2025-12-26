import React, { useState, useEffect } from 'react';
import { Transaction, RecordMode, TransactionType } from '../types';
import { CATEGORIES, NOTE_PRESETS } from '../constants';

interface InputFormProps {
  selectedDate: string;
  onSave: (transaction: Partial<Transaction>) => void;
  onDelete: (id: number) => void;
  editingTransaction: Transaction | null;
  onCancelEdit: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ selectedDate, onSave, onDelete, editingTransaction, onCancelEdit }) => {
  const [mode, setMode] = useState<RecordMode>('income');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>(CATEGORIES.income[0]);
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (editingTransaction) {
      setMode(editingTransaction.type === '收入' ? 'income' : 'expense');
      setCategory(editingTransaction.category);
      setAmount(editingTransaction.amount.toString());
      setNote(editingTransaction.note);
    } else {
      setAmount('');
      setNote('');
      // Reset category when switching back to default mode (income) or when clearing
      if (!editingTransaction && mode === 'income') setCategory(CATEGORIES.income[0]);
    }
  }, [editingTransaction]);

  // Handle category default when switching modes manually
  useEffect(() => {
     if (!editingTransaction) {
         if (mode === 'income') {
             setCategory(CATEGORIES.income[0]);
         } else {
             const firstGroup = Object.values(CATEGORIES.expense)[0];
             if (firstGroup && firstGroup.length > 0) setCategory(firstGroup[0]);
         }
     }
  }, [mode, editingTransaction]);

  const handleSubmit = () => {
    if (!amount || Number(amount) <= 0) return;
    
    onSave({
      date: selectedDate,
      type: mode === 'income' ? '收入' : '支出',
      category,
      amount: Number(amount),
      note,
      id: editingTransaction?.id
    });
    
    // Clear form if not editing (if editing, parent handles reset via prop change usually, but safe to clear here)
    if (!editingTransaction) {
        setAmount('');
        setNote('');
    }
  };

  const isIncome = mode === 'income';
  
  // Get presets for the current category
  const notePresets = NOTE_PRESETS[category] || [];

  return (
    <div className={`p-6 rounded-3xl shadow-lg border transition-all duration-300 relative ${
      isIncome ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
    } ${editingTransaction ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
      
      {editingTransaction && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm animate-pulse">
           編輯模式
        </div>
      )}

      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">SELECTED DATE</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">{selectedDate}</h3>
        </div>
        <span className={`px-4 py-1 rounded-full text-xs font-bold shadow-sm transition-colors text-white ${
          isIncome ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {isIncome ? '收入模式' : '支出模式'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button 
          onClick={() => setMode('income')}
          className={`py-4 rounded-xl font-bold transition-all text-sm md:text-base ${
            isIncome ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-white text-slate-400 hover:bg-slate-50'
          }`}
        >
          記收入
        </button>
        <button 
          onClick={() => setMode('expense')}
          className={`py-4 rounded-xl font-bold transition-all text-sm md:text-base ${
            !isIncome ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-white text-slate-400 hover:bg-slate-50'
          }`}
        >
          記支出
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <select 
            value={category}
            onChange={(e) => {
                setCategory(e.target.value);
                // Optional: clear note when category changes if you want strictly fresh inputs
                // setNote(''); 
            }}
            className="w-full bg-white border-none rounded-xl p-4 text-lg font-bold outline-none shadow-sm appearance-none text-slate-700"
          >
            {isIncome ? (
              CATEGORIES.income.map(c => <option key={c} value={c}>{c}</option>)
            ) : (
              Object.entries(CATEGORIES.expense).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))
            )}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
        </div>

        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          placeholder="請輸入金額" 
          className={`w-full bg-white border-none rounded-xl p-5 text-4xl font-black outline-none shadow-inner transition-colors placeholder:text-slate-200 ${
            isIncome ? 'text-green-600' : 'text-red-600'
          }`}
        />
        
        {/* Note Input Section: Split or Single */}
        <div className="flex gap-2">
            {notePresets.length > 0 && (
                <div className="relative w-1/3 min-w-[100px]">
                    <select
                        className="w-full h-full bg-white border-none rounded-xl px-3 pl-3 pr-6 text-sm font-bold outline-none shadow-sm appearance-none text-slate-600"
                        onChange={(e) => {
                            if(e.target.value) setNote(e.target.value);
                        }}
                        value="" // Always reset to allow re-selecting the same item if needed, relies on setNote
                    >
                        <option value="" disabled>快速選單</option>
                        {notePresets.map(preset => (
                            <option key={preset} value={preset}>{preset}</option>
                        ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                </div>
            )}
            
            <input 
              type="text" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={notePresets.length > 0 ? "或輸入備註..." : "備註事項..."}
              className={`bg-white border-none rounded-xl p-4 outline-none shadow-sm text-slate-600 ${notePresets.length > 0 ? 'flex-1' : 'w-full'}`}
            />
        </div>
        
        <div className="flex gap-2 pt-2">
          <button 
            onClick={handleSubmit}
            className="flex-1 bg-slate-900 text-white font-black py-4 rounded-xl text-lg shadow-xl hover:bg-black transition-transform active:scale-95"
          >
            {editingTransaction ? '更新紀錄' : '確認存入'}
          </button>
          
          {editingTransaction && (
            <>
              <button 
                onClick={onCancelEdit}
                className="px-4 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition"
              >
                取消
              </button>
              <button 
                onClick={() => onDelete(editingTransaction.id)}
                className="px-4 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition"
              >
                刪除
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InputForm;