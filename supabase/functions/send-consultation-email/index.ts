// supabase/functions/send-consultation-email/index.ts
// Sends consultation request email to hawwal.ogungbadero@gmail.com via Resend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const TO_EMAIL = 'hawwal.ogungbadero@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, message, wallet_address, tx_hash } = await req.json();

    if (!name || !email || !message || !wallet_address || !tx_hash) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailBody = `
New Consultation Request — Memory Master

Name: ${name}
Email: ${email}
Wallet: ${wallet_address}
Transaction Hash: ${tx_hash}

Message:
${message}

---
This request was submitted after paying 5 USDT on Memory Master.
Reply directly to ${email} to respond.
    `.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Memory Master <onboarding@resend.dev>',
        to: [TO_EMAIL],
        reply_to: email,
        subject: `New Consultation Request from ${name}`,
        text: emailBody,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Resend error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    console.log('Email sent:', data.id);

    return new Response(
      JSON.stringify({ success: true, email_id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
