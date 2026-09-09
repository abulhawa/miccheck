type StorageKind = 'localStorage' | 'sessionStorage';

export function readStorage(kind: StorageKind, key: string): string | null {
  try { return typeof window === 'undefined' ? null : window[kind].getItem(key); }
  catch { return null; }
}

export function writeStorage(kind: StorageKind, key: string, value: string | null): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (value === null) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
    return true;
  } catch { return false; }
}
