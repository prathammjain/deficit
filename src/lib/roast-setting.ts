/**
 * roast-setting.ts — GrainAI's roasts are part of the app, on for everyone.
 * The one way out is a quiet switch on the Profile screen.
 */

import { getJSON, kv, setJSON } from './kv';

const KEY = 'grain.roast.v1';

export async function loadRoastMode(): Promise<boolean> {
  return (await getJSON<boolean>(kv, KEY)) !== false;
}

export async function saveRoastMode(on: boolean): Promise<void> {
  await setJSON(kv, KEY, on);
}
