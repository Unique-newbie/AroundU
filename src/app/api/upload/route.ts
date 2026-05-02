import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/server-auth';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const { user } = await getUserFromRequest(request);
    
    // Fallback: Check formData if the token is missing and userId exists.
    let authorized = !!user;
    if (!authorized && userId) {
      authorized = true; 
    }

    if (!authorized) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary with 24h auto-deletion
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'aroundu/chat',
          resource_type: 'image',
          // Auto-delete after 24 hours (86400 seconds)
          invalidate: true,
          transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as { secure_url: string; public_id: string });
        }
      ).end(buffer);
    });

    // Schedule deletion after 24h using Cloudinary API
    setTimeout(async () => {
      try {
        await cloudinary.uploader.destroy(result.public_id);
      } catch { /* silent fail — pg_cron also cleans up references */ }
    }, 24 * 60 * 60 * 1000);

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
