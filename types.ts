export type TransactionType = '收入' | '支出';

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  note: string;
}

export interface CloudTransaction {
  id: number;
  date: string; // ISO string from Google Script
  type: string;
  category: string;
  amount: number | string;
  note: string;
}

export type ViewMode = 'record' | 'report';
export type RecordMode = 'income' | 'expense';
export type ReportTrendMode = 'month' | 'week' | 'day';

export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}