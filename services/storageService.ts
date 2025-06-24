
import type { AutologosIterativeEngineData } from '../types.ts';

const DB_NAME = 'AutologosIterativeEngineDB';
const STORE_NAME = 'appStateStore';
const DB_VERSION = 1; // Increment if schema changes significantly
const STATE_KEY = 'currentAppState_v2'; // New key for new data structure

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(new Error('Failed to open IndexedDB. Auto-save will be unavailable.'));
      dbPromise = null; 
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // If migrating from an old key or structure, you might want to handle it here.
      // For example, if an old STATE_KEY existed, you could try to read and transform it.
    };
  });
  return dbPromise;
};

// Now saves AutologosIterativeEngineData
export const saveState = async (engineData: AutologosIterativeEngineData): Promise<void> => {
  try {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Ensure lastAutoSavedAt is updated before saving
    const dataToSave = { ...engineData, lastAutoSavedAt: Date.now() };
    store.put(JSON.stringify(dataToSave), STATE_KEY);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Failed to save state to IndexedDB:', transaction.error);
        reject(new Error('Failed to save state.'));
      };
    });
  } catch (error) {
    console.error('Error getting DB for saveState:', error);
    throw error; 
  }
};

// Now loads AutologosIterativeEngineData
export const loadState = async (): Promise<AutologosIterativeEngineData | null> => {
  try {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result) {
          try {
            const parsedData = JSON.parse(request.result as string);
            resolve(parsedData as AutologosIterativeEngineData);
          } catch (e) {
            console.error('Failed to parse saved state:', e);
            resolve(null); 
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error('Failed to load state from IndexedDB:', request.error);
        reject(new Error('Failed to load state.'));
      };
    });
  } catch (error) {
    console.error('Error getting DB for loadState:', error);
    return null; 
  }
};

export const clearState = async (): Promise<void> => {
  try {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(STATE_KEY);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Failed to clear state from IndexedDB:', transaction.error);
        reject(new Error('Failed to clear state.'));
      };
    });
  } catch (error) {
    console.error('Error getting DB for clearState:', error);
    return;
  }
};

export const hasSavedState = async (): Promise<boolean> => {
  try {
    const state = await loadState();
    return state !== null;
  } catch (error) {
    return false;
  }
};