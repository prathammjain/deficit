/**
 * roast-setting.ts — whether the user has opted in to GrainAI's roasts.
 * Off until they turn it on.
 */

import { getJSON, kv, setJSON } from './kv';

const KEY = 'grain.roast.v1';

export async function loadRoastMode(): Promise<boolean> {
  return (await getJSON<boolean>(kv, KEY)) === true;
}

export async function saveRoastMode(on: boolean): Promise<void> {
  await setJSON(kv, KEY, on);
}
