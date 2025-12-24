import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  show: boolean;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, show, type = 'success', onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const bgClass = type === 'error' ? 'bg-red-600' : type === 'info' ? 'bg-blue-600' : 'bg-slate-800';

  return (
    <div className={`fixed bottom-12 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg ${bgClass} text-white text-sm font-bold flex items-center gap-2 animate-bounce-in`}>
      {type === 'success' && <span>✓</span>}
      {type === 'error' && <span>✕</span>}
      {message}
    </div>
  );
};

export default Toast;