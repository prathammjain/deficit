/**
 * The original bug was purely one of ordering: Chrome fires
 * `beforeinstallprompt` once, early, and a listener registered later never
 * sees it. So both orderings are what this pins down — the event arriving
 * before this module is even evaluated, and after.
 */

/** Mirrors the inline script in src/app/+html.tsx. Keep the two in step: this
 *  is the contract install-prompt.ts reads. */
function installBridgeScript(w: any): void {
  w.__deficitInstall = { prompt: null, installed: false };
  const notify = () => w.dispatchEvent(new Event('deficit:installchange'));
  w.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    w.__deficitInstall.prompt = e;
    notify();
  });
  w.addEventListener('appinstalled', () => {
    w.__deficitInstall.prompt = null;
    w.__deficitInstall.installed = true;
    notify();
  });
}

/** A stand-in for Chrome's non-standard event. */
function makePromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e: any = new Event('beforeinstallprompt');
  e.preventDefault = jest.fn();
  e.prompt = jest.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

function freshWindow() {
  const w: any = new EventTarget();
  (globalThis as any).window = w;
  installBridgeScript(w);
  return w;
}

afterEach(() => {
  delete (globalThis as any).window;
  jest.resetModules();
});

describe('install prompt capture', () => {
  it('sees a prompt that fired before this module loaded', async () => {
    const w = freshWindow();
    const event = makePromptEvent();
    w.dispatchEvent(event); // Chrome fires on Home, long before Profile mounts

    const { getInstallState } = await import('./install-prompt');

    expect(getInstallState().prompt).toBe(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('sees a prompt that fires after this module loaded', async () => {
    const w = freshWindow();
    const { getInstallState } = await import('./install-prompt');
    expect(getInstallState().prompt).toBeNull();

    const event = makePromptEvent();
    w.dispatchEvent(event);

    expect(getInstallState().prompt).toBe(event);
  });

  it('returns a new snapshot object when the state changes', async () => {
    // The bridge is mutated in place, so useSyncExternalStore would never see
    // a change if the snapshot were the bridge itself.
    const w = freshWindow();
    const { getInstallState } = await import('./install-prompt');
    const before = getInstallState();

    w.dispatchEvent(makePromptEvent());

    expect(getInstallState()).not.toBe(before);
  });

  it('reports installed and drops the prompt on appinstalled', async () => {
    const w = freshWindow();
    w.dispatchEvent(makePromptEvent());
    const { getInstallState } = await import('./install-prompt');

    w.dispatchEvent(new Event('appinstalled'));

    expect(getInstallState().installed).toBe(true);
    expect(getInstallState().prompt).toBeNull();
  });

  it('is inert with no window (static render)', async () => {
    delete (globalThis as any).window;
    const { getInstallState } = await import('./install-prompt');
    expect(getInstallState()).toEqual({ prompt: null, installed: false });
  });
});

describe('promptInstall', () => {
  it('shows the prompt and reports the outcome', async () => {
    const w = freshWindow();
    const event = makePromptEvent('accepted');
    w.dispatchEvent(event);
    const { promptInstall } = await import('./install-prompt');

    await expect(promptInstall()).resolves.toBe('accepted');
    expect(event.prompt).toHaveBeenCalled();
  });

  it('consumes the prompt, since it cannot be used twice', async () => {
    const w = freshWindow();
    w.dispatchEvent(makePromptEvent('dismissed'));
    const { getInstallState, promptInstall } = await import('./install-prompt');

    await expect(promptInstall()).resolves.toBe('dismissed');
    // Gone, so the UI falls back to the manual instructions — the honest
    // state, since Chrome will not re-offer until its criteria trigger again.
    expect(getInstallState().prompt).toBeNull();
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('reports unavailable when no prompt was ever offered', async () => {
    freshWindow();
    const { promptInstall } = await import('./install-prompt');
    await expect(promptInstall()).resolves.toBe('unavailable');
  });
});
