/**
 * state.ts: the CRM's data for the laptop screens, loaded once and kept in
 * memory, so filtering, sorting and switching views are instant. Changes
 * show at once and save behind the scenes; a save that fails is undone and
 * reported.
 */

import { useCallback, useEffect, useState } from 'react';

import type { MetricRow } from '@/lib/admin/format';
import {
  addCreators as insertCreators,
  addMetrics,
  addTouch,
  deleteCreator,
  fetchUsers,
  listAllTouches,
  listCreators,
  listMetrics,
  saveCreator,
  updateCreators,
  type AdminUser,
  type Creator,
  type CreatorFields,
  type Touch,
} from '@/lib/supabase/admin';

import { message } from '../ui';

export interface CrmData {
  creators: Creator[];
  metrics: MetricRow[];
  touches: Touch[];
  users: AdminUser[];
}

export type Crm = ReturnType<typeof useCrm>;

export function useCrm() {
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        listCreators(),
        listMetrics(),
        listAllTouches(),
        fetchUsers(''),
      ]).then(
        ([creators, metrics, touches, users]) => {
          setData({ creators, metrics, touches, users });
          setError(null);
        },
        (e) => setError(message(e)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Applies the change at once; puts the old values back if saving fails. */
  const patchCreators = useCallback(
    (ids: string[], patch: Partial<CreatorFields>) => {
      const before = new Map(
        (data?.creators ?? [])
          .filter((c) => ids.includes(c.id))
          .map((c) => [c.id, c]),
      );
      const stamp = new Date().toISOString();
      setData(
        (d) =>
          d && {
            ...d,
            creators: d.creators.map((c) =>
              ids.includes(c.id) ? { ...c, ...patch, updated_at: stamp } : c,
            ),
          },
      );
      return updateCreators(ids, patch).catch((e) => {
        setData(
          (d) =>
            d && {
              ...d,
              creators: d.creators.map((c) => before.get(c.id) ?? c),
            },
        );
        setError(message(e));
      });
    },
    [data],
  );

  const addCreator = useCallback(
    async (fields: CreatorFields): Promise<Creator | null> => {
      try {
        const c = await saveCreator(fields);
        setData((d) => d && { ...d, creators: [c, ...d.creators] });
        return c;
      } catch (e) {
        setError(message(e));
        return null;
      }
    },
    [],
  );

  /** Adds many at once; the number added, or null when saving failed. */
  const addCreators = useCallback(
    async (rows: CreatorFields[]): Promise<number | null> => {
      try {
        const added = await insertCreators(rows);
        setData((d) => d && { ...d, creators: [...added, ...d.creators] });
        return added.length;
      } catch (e) {
        setError(message(e));
        return null;
      }
    },
    [],
  );

  const saveDetails = useCallback(
    async (id: string, fields: CreatorFields): Promise<boolean> => {
      try {
        const c = await saveCreator(fields, id);
        setData(
          (d) =>
            d && {
              ...d,
              creators: d.creators.map((x) => (x.id === id ? c : x)),
            },
        );
        return true;
      } catch (e) {
        setError(message(e));
        return false;
      }
    },
    [],
  );

  const removeCreator = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteCreator(id);
      setData(
        (d) =>
          d && {
            ...d,
            creators: d.creators.filter((c) => c.id !== id),
            metrics: d.metrics.filter((m) => m.creator_id !== id),
            touches: d.touches.filter((t) => t.creator_id !== id),
          },
      );
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  }, []);

  const logTouch = useCallback(
    async (row: Omit<Touch, 'id' | 'created_at'>): Promise<boolean> => {
      try {
        const t = await addTouch(row);
        setData((d) => d && { ...d, touches: [t, ...d.touches] });
        return true;
      } catch (e) {
        setError(message(e));
        return false;
      }
    },
    [],
  );

  const addMetric = useCallback(
    async (row: Omit<MetricRow, 'id' | 'created_at'>): Promise<boolean> => {
      try {
        const m = await addMetrics(row);
        setData((d) => d && { ...d, metrics: [...d.metrics, m] });
        return true;
      } catch (e) {
        setError(message(e));
        return false;
      }
    },
    [],
  );

  const refreshUsers = useCallback(
    () =>
      fetchUsers('').then(
        (users) => setData((d) => d && { ...d, users }),
        (e) => setError(message(e)),
      ),
    [],
  );

  return {
    data,
    error,
    setError,
    load,
    patchCreators,
    addCreator,
    addCreators,
    saveDetails,
    removeCreator,
    logTouch,
    addMetric,
    refreshUsers,
  };
}
