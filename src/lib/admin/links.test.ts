import { chatText } from './chat-file';
import {
  importRows,
  linksIn,
  parseChat,
  profileFromUrl,
  rowToCreator,
  scanChat,
} from './links';

const ANDROID = [
  '12/11/2026, 21:02 - Messages and calls are end to end encrypted. Learn more.',
  '12/11/2026, 21:05 - Pratham: https://www.instagram.com/fit.rahul?igsh=MTN2 powerlifter, Pune, 180k',
  '12/11/2026, 21:06 - Pratham: her youtube https://youtube.com/@Fit.Rahul and',
  'this one instagram.com/mumbai_lifts/',
  '12/11/2026, 21:07 - Aman: https://www.instagram.com/reel/C9xYz123/?igsh=abc',
  '13/11/2026, 08:15 - Aman: https://x.com/CoachDev/status/1234567 great thread',
  '13/11/2026, 08:16 - Pratham: https://www.instagram.com/fit.rahul/ again',
].join('\n');

const IPHONE = [
  '[12/11/26, 9:05:12 PM] Pratham: ‎https://www.instagram.com/stories/gym.queen/3456/?utm_source=ig_story_item_share',
  '[12/11/26, 9:06:40 PM] Pratham: Coach in Delhi',
  'https://www.tiktok.com/@shredded.sam/video/72981',
  '[12/11/26, 9:07:01 PM] Pratham: ‎<attached: 00000012-PHOTO.jpg>',
].join('\n');

describe('profileFromUrl', () => {
  const handle = (url: string) => {
    const p = profileFromUrl(url);
    return p && p !== 'post' ? `${p.site} ${p.handle}` : p;
  };

  it('reads profiles on every site, ignoring tracking and case', () => {
    expect(handle('https://www.instagram.com/Fit.Rahul?igsh=x')).toBe(
      'instagram @fit.rahul',
    );
    expect(handle('instagram.com/_u/fit.rahul')).toBe('instagram @fit.rahul');
    expect(handle('https://instagram.com/stories/gym.queen/123/')).toBe(
      'instagram @gym.queen',
    );
    expect(handle('https://m.youtube.com/@LiftLab')).toBe('youtube @liftlab');
    expect(handle('https://www.youtube.com/c/FitRahul')).toBe(
      'youtube fitrahul',
    );
    expect(
      handle('https://www.youtube.com/channel/UC1234567890abcdefghijKL'),
    ).toBe('youtube UC1234567890abcdefghijKL');
    expect(handle('https://twitter.com/FitDev')).toBe('x @fitdev');
    expect(handle('https://x.com/fitdev/status/99')).toBe('x @fitdev');
    expect(handle('https://www.threads.net/@coach.anu')).toBe(
      'threads @coach.anu',
    );
    expect(handle('https://www.tiktok.com/@shredded.sam/video/1')).toBe(
      'tiktok @shredded.sam',
    );
    expect(handle('https://in.linkedin.com/in/nisha-rd/')).toBe(
      'linkedin nisha-rd',
    );
    expect(handle('https://facebook.com/fitnessbyraj')).toBe(
      'facebook fitnessbyraj',
    );
    expect(handle('https://www.snapchat.com/add/rahul_fit')).toBe(
      'snapchat @rahul_fit',
    );
    expect(handle('https://linktr.ee/liftwithkiran')).toBe(
      'linktree @liftwithkiran',
    );
  });

  it('a post, reel, video or short link names no one', () => {
    for (const url of [
      'https://www.instagram.com/p/ABC/',
      'https://www.instagram.com/reel/C9x/?igsh=1',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/shorts/abc',
      'https://vm.tiktok.com/ZMabc/',
      'https://www.facebook.com/share/r/abc/',
    ]) {
      expect(profileFromUrl(url)).toBe('post');
    }
  });

  it('pages and other sites are not profiles', () => {
    for (const url of [
      'https://www.instagram.com/explore/tags/fitness/',
      'https://twitter.com/home',
      'https://www.facebook.com/profile.php?id=123',
      'https://www.facebook.com/groups/lifters',
      'https://www.youtube.com/',
      'https://example.com/fit',
      'https://getgrain.fit/go',
    ]) {
      expect(profileFromUrl(url)).toBeNull();
    }
  });
});

describe('parseChat', () => {
  it('reads Android exports, with messages that run over several lines', () => {
    const msgs = parseChat(ANDROID);
    expect(msgs).toHaveLength(6);
    expect(msgs[0].sender).toBeNull(); // the encryption notice
    expect(msgs[2]).toEqual({
      when: '12/11/2026',
      sender: 'Pratham',
      text: 'her youtube https://youtube.com/@Fit.Rahul and\nthis one instagram.com/mumbai_lifts/',
    });
  });

  it('reads iPhone exports, invisible marks and all', () => {
    const msgs = parseChat(IPHONE);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].when).toBe('12/11/26');
    expect(msgs[0].text.startsWith('https://')).toBe(true);
    expect(msgs[1].text).toBe(
      'Coach in Delhi\nhttps://www.tiktok.com/@shredded.sam/video/72981',
    );
  });

  it('pasted text with no WhatsApp lines is one message', () => {
    expect(parseChat('a\nb\n')).toEqual([
      { when: null, sender: null, text: 'a\nb\n' },
    ]);
  });
});

describe('linksIn', () => {
  it('drops the punctuation around a link', () => {
    expect(linksIn('see https://x.com/abc. and (instagram.com/def)!')).toEqual([
      'https://x.com/abc',
      'instagram.com/def',
    ]);
  });
});

describe('scanChat', () => {
  const scan = scanChat(ANDROID);

  it('finds each profile once, counts repeats, keeps the message as context', () => {
    expect(
      scan.profiles.map((f) => `${f.profile.site} ${f.profile.handle}`),
    ).toEqual([
      'instagram @fit.rahul',
      'youtube @fit.rahul',
      'instagram @mumbai_lifts',
      'x @coachdev',
    ]);
    const rahul = scan.profiles[0];
    expect(rahul.mentions).toBe(2);
    expect(rahul.when).toBe('12/11/2026');
    expect(rahul.context).toBe('powerlifter, Pune, 180k');
    expect(rahul.profile.url).toBe('https://www.instagram.com/fit.rahul/');
  });

  it('lists reels and videos apart, since they name no one', () => {
    expect(scan.posts).toEqual([
      {
        url: 'https://www.instagram.com/reel/C9xYz123/?igsh=abc',
        when: '12/11/2026',
        context: '',
      },
    ]);
  });

  it('reads iPhone exports too', () => {
    const s = scanChat(IPHONE);
    expect(s.profiles.map((f) => [f.profile.handle, f.context])).toEqual([
      ['@gym.queen', ''],
      ['@shredded.sam', 'Coach in Delhi'],
    ]);
  });
});

describe('importRows', () => {
  it('one creator per handle, Instagram first, marking who is already in', () => {
    const rows = importRows(scanChat(ANDROID), [
      { handle: '@Mumbai_Lifts' },
      { handle: 'https://www.youtube.com/@coachdev' },
      { handle: null },
    ]);
    expect(rows.map((r) => [r.key, r.platform, r.existing])).toEqual([
      ['fit.rahul', 'instagram', false],
      ['mumbai_lifts', 'instagram', true],
      ['coachdev', 'x', true],
    ]);
    expect(rows[0].profiles.map((p) => p.site)).toEqual([
      'instagram',
      'youtube',
    ]);
    expect(rows[0].mentions).toBe(3);
  });

  it('sites the CRM has no platform for go in as other', () => {
    const [row] = importRows(
      scanChat('https://www.threads.net/@coach.anu'),
      [],
    );
    expect(row.platform).toBe('other');
    expect(row.handle).toBe('@coach.anu');
  });
});

describe('rowToCreator', () => {
  it('a prospect, with where it came from and every link in the notes', () => {
    const [row] = importRows(scanChat(ANDROID), []);
    expect(rowToCreator(row)).toEqual({
      name: 'fit.rahul',
      handle: '@fit.rahul',
      platform: 'instagram',
      niche: null,
      city: null,
      country: null,
      email: null,
      phone: null,
      stage: 'prospect',
      next_follow_up: null,
      grain_user_id: null,
      track_record: null,
      notes: [
        'From WhatsApp, shared 12/11/2026: powerlifter, Pune, 180k',
        'Instagram: https://www.instagram.com/fit.rahul/',
        'YouTube: https://www.youtube.com/@fit.rahul',
      ].join('\n'),
    });
  });

  it('pasted links say so', () => {
    const [row] = importRows(scanChat('https://x.com/abc'), []);
    expect(rowToCreator(row).notes).toBe(
      'From imported links\nX: https://x.com/abc',
    );
  });
});

describe('chatText', () => {
  const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, 'base64'));
  // An iPhone export: a zip holding _chat.txt, deflated.
  const IPHONE_ZIP =
    'UEsDBBQAAAAIAGUcbV1HidEqggAAAKcAAAAJAAAAX2NoYXQudHh0izY00jc01Dcy01GwtDIwtTI0etSwPsA3ViGgKLEkIzHXSuFRQ19GSUlBsZW+fnl5uV5mXnFJYnpRYq5ecn6ufnplrl5haWpqnr59Znpxhm1iUrJCcUlRfl66QkpqYkpOZlpJMVc0ih1mViYG6HYgW1CZX1pSmpQKNt4BZEBOYhIXAFBLAQIUAxQAAAAIAGUcbV1HidEqggAAAKcAAAAJAAAAAAAAAAAAAACAAQAAAABfY2hhdC50eHRQSwUGAAAAAAEAAQA3AAAAqQAAAAAA';
  const PHOTO_ZIP =
    'UEsDBBQAAAAIAGUcbV0dOJPzCgAAAAgAAAAJAAAAcGhvdG8uanBny8svSSxJrSgBAFBLAQIUAxQAAAAIAGUcbV0dOJPzCgAAAAgAAAAJAAAAAAAAAAAAAACAAQAAAABwaG90by5qcGdQSwUGAAAAAAEAAQA3AAAAMQAAAAAA';

  it('reads the chat inside an iPhone zip', async () => {
    const text = await chatText(bytes(IPHONE_ZIP));
    expect(scanChat(text).profiles.map((f) => f.profile.handle)).toEqual([
      '@gym.queen',
      '@liftlab',
    ]);
  });

  it('reads an Android .txt as it is', async () => {
    expect(await chatText(new TextEncoder().encode(ANDROID))).toBe(ANDROID);
  });

  it('a zip with no chat in it is an error, not an empty import', async () => {
    await expect(chatText(bytes(PHOTO_ZIP))).rejects.toThrow('No chat text');
  });
});
