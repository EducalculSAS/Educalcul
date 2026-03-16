import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { planId, userId, email } = await req.json();

    if (!planId || !userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let priceAmount = 0;
    let productName = '';

    // Define plan details
    // Note: In production, you should use Price IDs from Stripe Dashboard
    switch (planId) {
      case 'premium':
        priceAmount = 999; // 9.99 EUR in cents
        productName = 'Educalcul Premium';
        break;
      case 'family':
        priceAmount = 1999; // 19.99 EUR in cents
        productName = 'Educalcul Famille';
        break;
      default:
        return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
            },
            unit_amount: priceAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/parent/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/parent/subscription`,
      customer_email: email,
      metadata: {
        userId: userId,
        planId: planId,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
