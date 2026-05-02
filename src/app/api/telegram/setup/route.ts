import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, deleteWebhook, getWebhookInfo, setMyCommands } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'info';

  if (action === 'set') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
    const webhookUrl = `${appUrl}/api/telegram`;
    const result = await setWebhook(webhookUrl, process.env.TELEGRAM_WEBHOOK_SECRET || '');
    await setMyCommands();
    return NextResponse.json({ action: 'set', webhookUrl, result });
  }

  if (action === 'delete') {
    const result = await deleteWebhook();
    return NextResponse.json({ action: 'delete', result });
  }

  const info = await getWebhookInfo();
  return NextResponse.json({ action: 'info', info });
}
