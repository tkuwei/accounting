import { CLOUD_URL, STORAGE_KEY } from '../constants';
import { Transaction, CloudTransaction } from '../types';

export const loadLocalData = (): Transaction[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load local data", e);
    return [];
  }
};

export const saveLocalData = (data: Transaction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const fetchCloudData = async (): Promise<Transaction[]> => {
  const response = await fetch(CLOUD_URL);
  const cloudData: CloudTransaction[] = await response.json();
  
  if (Array.isArray(cloudData)) {
    return cloudData
      .filter(r => r.amount && !isNaN(Number(r.amount)))
      .map((r, index) => {
        // Date parsing logic matching original code to fix timezone issues
        let dateObj = new Date(r.date);
        if (isNaN(dateObj.getTime())) dateObj = new Date();

        // Use sv-SE for YYYY-MM-DD format with Taipei timezone
        const cleanDate = dateObj.toLocaleDateString('sv-SE', {
            timeZone: 'Asia/Taipei'
        });

        return {
            id: r.id || (Date.now() + index),
            date: cleanDate,
            type: r.type as '收入' | '支出',
            category: r.category,
            amount: Number(r.amount),
            note: r.note || ''
        };
      });
  }
  return [];
};

export const syncTransactionToCloud = async (transaction: Partial<Transaction> & { action?: 'delete' }) => {
  const payload = {
    ...transaction,
    id: transaction.id || Date.now()
  };
  
  await fetch(CLOUD_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify(payload)
  });
};