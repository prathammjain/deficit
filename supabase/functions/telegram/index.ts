// telegram: Grain's CRM bot. Every message in a connected Telegram chat
// comes here; each creator profile link in it is added to the CRM as a
// prospect, Waiting in the admin, and the bot replies with what landed.
// Messages without links are left alone.
//
// Free: Telegram's Bot API costs nothing, and this runs on Supabase's edge
// functions like the food engine.
//
// Secrets (supabase secrets set ...):
//   TELEGRAM_BOT_TOKEN       from @BotFather
//   TELEGRAM_WEBHOOK_SECRET  any long random string, also given to setWebhook,
//                            so only Telegram can post here
//   TELEGRAM_CHAT_IDS        the chats allowed to add creators, comma separated.
//                            A message from any other chat gets its id back.
//
// Deploy: supabase functions deploy telegram --no-verify-jwt
// (Telegram can't send a Supabase sign in; the webhook secret guards it.)

import {
  planTelegramMessage,
  telegramReply,
  type TelegramMessage,
} from '../_shared/links.ts';

const env = (k: string) => Deno.env.get(k)?.trim() ?? '';

function rest(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function reply(msg: TelegramMessage, text: string) {
  await fetch(
    `https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        text,
        reply_parameters: { message_id: msg.message_id },
        disable_notification: true,
        link_preview_options: { is_disabled: true },
      }),
    },
  ).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok');
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (
    !secret ||
    req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret
  ) {
    return new Response('forbidden', { status: 403 });
  }

  // Always answer 200 once the update is read: Telegram retries anything
  // else, which would add the same creators again.
  try {
    const update = await req.json();
    const msg: TelegramMessage | undefined =
      update?.message ?? update?.channel_post;
    if (!msg?.chat) return new Response('ok');

    const allowed = env('TELEGRAM_CHAT_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let existing: { handle: string | null }[] = [];
    if (allowed.includes(String(msg.chat.id))) {
      const res = await rest('crm_creators?select=handle');
      if (!res.ok) throw new Error(`crm read ${res.status}`);
      existing = await res.json();
    }

    const plan = planTelegramMessage(msg, allowed, existing);
    if (plan.kind === 'add' && plan.creators.length) {
      const res = await rest('crm_creators', {
        method: 'POST',
        body: JSON.stringify(plan.creators),
      });
      if (!res.ok) {
        await reply(msg, 'Couldn’t add that to the CRM. Try again in a bit.');
        return new Response('ok');
      }
    }
    const text = telegramReply(plan);
    if (text) await reply(msg, text);
  } catch (e) {
    console.error('telegram', e);
  }
  return new Response('ok');
});
