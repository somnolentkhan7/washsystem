import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    const baseUrl =
      process.env.NEXT_PUBLIC_URL || "https://your-domain.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Power Washing Service",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe error:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}