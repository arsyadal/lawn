'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useApiData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try { setData(await api<T>(path)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Data tidak dapat dimuat.'); }
    finally { setLoading(false); }
  }, [path]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, setData, error, loading, refresh };
}
