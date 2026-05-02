import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, deleteWebhook, getWebhookInfo, setMyCommands } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'info';

  if (action === 'set') {
    const host = req.headers.get('host') || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${host}`;
    // Ensure https://
    const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const webhookUrl = `${baseUrl}/api/telegram`;
    // Don't send secret if empty
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const result = await setWebhook(webhookUrl, secret && secret.length > 0 ? secret : undefined as any);
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
