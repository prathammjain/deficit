import {
  aiLeft,
  getAiAccess,
  noteAiGate,
  noteAiUsage,
  resetAiAccess,
  setAiAccessFromServer,
} from './ai-access';

afterEach(resetAiAccess);

describe('GrainAI access mirror', () => {
  it('assumes yes until the server says otherwise', () => {
    expect(getAiAccess()).toEqual({ allowed: true, limit: null, used: null });
    expect(aiLeft(getAiAccess())).toBeNull();
  });

  it('reads my_ai()', () => {
    setAiAccessFromServer({ allowed: true, limit: 12, used: 9 });
    expect(aiLeft(getAiAccess())).toBe(3);
    setAiAccessFromServer({ allowed: false, limit: 12, used: 0 });
    expect(getAiAccess().allowed).toBe(false);
  });

  it('ignores an answer it cannot read', () => {
    setAiAccessFromServer({ nope: true });
    expect(getAiAccess().allowed).toBe(true);
  });

  it('counts down with each match and stops at the limit', () => {
    noteAiUsage({ used: 11, limit: 12 });
    expect(aiLeft(getAiAccess())).toBe(1);
    noteAiGate('daily_limit', 12);
    expect(aiLeft(getAiAccess())).toBe(0);
    expect(getAiAccess().allowed).toBe(true);
  });

  it('an invite refusal turns GrainAI off; an outage changes nothing', () => {
    noteAiGate('unavailable');
    expect(getAiAccess().allowed).toBe(true);
    noteAiGate('invite_only');
    expect(getAiAccess().allowed).toBe(false);
  });
});
