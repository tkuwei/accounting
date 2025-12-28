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
  try {
    const response = await fetch(CLOUD_URL);
    
    // Safety: Handle non-JSON responses (e.g., Google Script error HTML pages)
    const text = await response.text();
    let cloudData: CloudTransaction[];
    
    try {
        cloudData = JSON.parse(text);
    } catch (e) {
        console.error("Cloud returned non-JSON response:", text.substring(0, 100));
        throw new Error("Invalid server response");
    }
    
    if (Array.isArray(cloudData)) {
      return cloudData
        .filter(r => r.amount && !isNaN(Number(r.amount)))
        .map((r, index) => {
          // Robust Date Parsing for iOS Safari
          // Safari handles '2023-01-01' well, but fails on some ISO strings or standard 'new Date()' implications
          let dateObj: Date;
          
          if (typeof r.date === 'string') {
             // Handle simple YYYY-MM-DD string to avoid timezone shifts
             if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
                 dateObj = new Date(r.date + 'T00:00:00'); 
             } else {
                 dateObj = new Date(r.date);
             }
          } else {
             dateObj = new Date(r.date);
          }

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
  } catch (error) {
    console.error("Fetch Cloud Data Error:", error);
    throw error; // Propagate error so UI knows sync failed
  }
};

export const syncTransactionToCloud = async (transaction: Partial<Transaction> & { action?: 'delete' }) => {
  const payload = {
    ...transaction,
    id: transaction.id || Date.now()
  };
  
  // Note: mode 'no-cors' means we cannot read the response status/body.
  // The promise resolves even if the server throws a 500 error, as long as network is reachable.
  await fetch(CLOUD_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};