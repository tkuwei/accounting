import React, { useState, useEffect } from 'react';
import { Transaction, ViewMode, ToastState, SyncStatus } from './types';
import { loadLocalData, saveLocalData, fetchCloudData, syncTransactionToCloud } from './services/api';
import Calendar from './components/Calendar';
import InputForm from './components/InputForm';
import ReportDashboard from './components/ReportDashboard';
import Loading from './components/Loading';
import Toast from './components/Toast';
import { LayoutDashboard, PenTool, Edit3 } from 'lucide-react';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('record');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }));
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState<boolean>(false); // Only for first load
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle'); // Non-blocking status
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  // Initial Load
  useEffect(() => {
    const local = loadLocalData();
    if (local.length > 0) setTransactions(local);
    
    const sync = async () => {
      setInitialLoading(true);
      try {
        const cloud = await fetchCloudData();
        if (cloud.length > 0) {
          setTransactions(cloud);
          saveLocalData(cloud);
        }
      } catch (e) {
        showToast('無法同步雲端資料，使用本地備份', 'error');
      } finally {
        setInitialLoading(false);
      }
    };
    sync();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
  };

  const handleSaveTransaction = async (data: Partial<Transaction>) => {
    // Optimistic Update
    const newTx = { ...data, id: data.id || Date.now() } as Transaction;
    let newTransactions;
    
    if (editingId) {
      newTransactions = transactions.map(t => t.id === editingId ? newTx : t);
    } else {
      newTransactions = [...transactions, newTx];
    }

    setTransactions(newTransactions);
    saveLocalData(newTransactions);
    setEditingId(null);

    // Non-blocking Sync to Cloud
    setSyncStatus('saving');
    try {
      await syncTransactionToCloud(newTx);
      setSyncStatus('success');
      // Revert to idle after 3 seconds so the green dot doesn't stay forever
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      // Only show toast if it was an edit, for new records the green dot is enough feedback
      if (editingId) showToast('修改完成');
    } catch (e) {
      setSyncStatus('error');
      showToast('儲存失敗，請檢查網路', 'error');
      // Keep error status visible a bit longer or until next action
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;

    const newTransactions = transactions.filter(t => t.id !== id);
    setTransactions(newTransactions);
    saveLocalData(newTransactions);
    setEditingId(null);

    setSyncStatus('saving');
    try {
      const txToDelete = transactions.find(t => t.id === id);
      if (txToDelete) {
        await syncTransactionToCloud({ id, date: txToDelete.date, action: 'delete' });
      }
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
      showToast('紀錄已刪除', 'info');
    } catch (e) {
      setSyncStatus('error');
      showToast('刪除失敗', 'error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const dayDetails = transactions.filter(t => t.date === selectedDate);
  const editingTransaction = transactions.find(t => t.id === editingId) || null;

  return (
    <div className="min-h-screen pb-10">
      {/* Only show blocking loading on initial start */}
      <Loading isLoading={initialLoading} />
      
      <Toast 
        show={toast.show} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast(prev => ({ ...prev, show: false }))} 
      />

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 bg-orange-50 p-2 rounded-2xl shadow-sm border border-orange-100 max-w-md mx-auto">
          <button 
            onClick={() => setViewMode('record')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              viewMode === 'record' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:bg-white/50'
            }`}
          >
            <PenTool size={18} /> 記帳錄入
          </button>
          <button 
             onClick={() => setViewMode('report')}
             className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              viewMode === 'report' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'text-slate-400 hover:bg-white/50'
            }`}
          >
            <LayoutDashboard size={18} /> 經營報表
          </button>
        </div>

        {viewMode === 'record' ? (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Calendar & Details */}
            <div className="w-full md:w-5/12 space-y-6">
              <Calendar 
                viewDate={viewDate} 
                selectedDate={selectedDate}
                transactions={transactions}
                onSelectDate={setSelectedDate}
                onMonthChange={(diff) => {
                  const d = new Date(viewDate);
                  d.setMonth(d.getMonth() + diff);
                  setViewDate(d);
                }}
              />
              
              <div className="bg-orange-50 p-5 rounded-3xl shadow-lg border border-orange-100 min-h-[300px]">
                <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2 text-lg">
                  <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                  當日明細
                </h4>
                <div className="space-y-3">
                  {dayDetails.length === 0 ? (
                    <div className="text-center py-10 text-slate-300">
                      <p>本日無紀錄</p>
                    </div>
                  ) : (
                    dayDetails.map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => setEditingId(t.id)}
                        className={`group cursor-pointer flex justify-between items-center p-4 rounded-2xl border transition-all hover:shadow-md bg-white ${
                          t.type === '收入' ? 'border-green-100 hover:border-green-300' : 'border-red-100 hover:border-red-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              t.type === '收入' ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
                            }`}>{t.category}</span>
                            <span className="font-black text-slate-700 text-lg">
                              ${t.amount.toLocaleString()}
                            </span>
                          </div>
                          {t.note && <p className="text-xs text-slate-400 pl-1">{t.note}</p>}
                        </div>
                        <Edit3 size={16} className="text-slate-300 group-hover:text-orange-400 transition-colors" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Input Form */}
            <div className="flex-1">
              <div className="sticky top-6">
                <InputForm 
                  selectedDate={selectedDate}
                  onSave={handleSaveTransaction}
                  onDelete={handleDeleteTransaction}
                  editingTransaction={editingTransaction}
                  onCancelEdit={() => setEditingId(null)}
                  syncStatus={syncStatus}
                />
              </div>
            </div>
          </div>
        ) : (
          <ReportDashboard transactions={transactions} />
        )}
      </div>
    </div>
  );
};

export default App;