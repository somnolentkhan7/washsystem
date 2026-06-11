import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  if (!input) return NextResponse.json({ predictions: [] });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&key=${process.env.GOOGLE_MAPS_API_KEY}`
  );
  const data = await res.json();
  return NextResponse.json(data);
}