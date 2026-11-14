import { NextResponse } from 'next/server';
import { forecast } from '@/lib/server/weather';

export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }
    try {
        return NextResponse.json(await forecast(lat, lon));
    } catch (err) {
        console.error('[weather]', err);
        return NextResponse.json({ error: 'unavailable' }, { status: 502 });
    }
}
