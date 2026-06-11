import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("place_id");
  const address = req.nextUrl.searchParams.get("address");
  const latlng = req.nextUrl.searchParams.get("latlng");

  let param = "";
  if (placeId) param = `place_id=${encodeURIComponent(placeId)}`;
  else if (latlng) param = `latlng=${encodeURIComponent(latlng)}`;
  else if (address) param = `address=${encodeURIComponent(address)}`;
  else return NextResponse.json({ results: [] });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${param}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  );
  const data = await res.json();
  return NextResponse.json(data);
}