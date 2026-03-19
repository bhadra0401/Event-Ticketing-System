import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TicketEmailRequest {
  email: string;
  name: string;
  ticketId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, name, ticketId }: TicketEmailRequest = await req.json();

    if (!email || !name || !ticketId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const ticketUrl = `${req.headers.get('origin') || 'http://localhost:5173'}/ticket/${ticketId}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .warning {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🎉 FAREWELL PARTY</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Dance • Music • Nightlife</p>
        </div>

        <div class="content">
          <h2 style="color: #1f2937; margin-top: 0;">Hi ${name}!</h2>

          <p>Your ticket for the Farewell Party is ready! We're excited to celebrate with you.</p>

          <div style="text-align: center;">
            <a href="${ticketUrl}" class="button">View Your Ticket</a>
          </div>

          <div class="warning">
            <strong style="color: #991b1b;">⚠️ IMPORTANT:</strong>
            <p style="margin: 10px 0 0 0; color: #991b1b;">College ID Card is MANDATORY for entry. You will not be allowed in without it.</p>
          </div>

          <h3 style="color: #1f2937;">What to do:</h3>
          <ol style="color: #4b5563;">
            <li>Click the button above to view your digital ticket</li>
            <li>Save the link or bookmark it for easy access</li>
            <li>Bring your College ID Card to the venue</li>
            <li>Show your QR code at the entrance for scanning</li>
          </ol>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            <strong>Ticket URL:</strong><br>
            <a href="${ticketUrl}" style="color: #2563eb; word-break: break-all;">${ticketUrl}</a>
          </p>
        </div>

        <div class="footer">
          <p>See you at the party! 🎊</p>
          <p style="font-size: 12px; margin-top: 10px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </body>
      </html>
    `;

    
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Farewell Party <onboarding@resend.dev>",
        to: email, 
        subject: "🎉 Your Farewell Party Ticket is Here!",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        ticketUrl: ticketUrl
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending ticket:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to send ticket email",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
