import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createTransport } from "npm:nodemailer";

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
  isUpdate?: boolean; // New flag added here
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, name, ticketId, isUpdate }: TicketEmailRequest = await req.json();

    if (!email || !name || !ticketId) {
      throw new Error("Missing required fields");
    }

    const ticketUrl = `${req.headers.get('origin') || 'http://localhost:5173'}/ticket/${ticketId}`;

    // Dynamic content based on whether it's a new ticket or an update
    const subject = isUpdate 
      ? "🔄 Update: Your Farewell Party Ticket Details" 
      : "🎉 Your Farewell Party Ticket is Here!";
    
    const messageHeadline = isUpdate 
      ? "Your ticket details have been updated!" 
      : "Your ticket for the Farewell Party is ready!";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b4513 0%, #2a160d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; padding: 15px 30px; background: #8b4513; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .update-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">🎉 FAREWELL PARTY</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Dance • Music • Nightlife</p>
        </div>
        <div class="content">
          ${isUpdate ? '<div class="update-badge">INFORMATION UPDATED</div>' : ''}
          <h2>Hi ${name}!</h2>
          <p>${messageHeadline} We're excited to celebrate with you.</p>
          <div style="text-align: center;">
            <a href="${ticketUrl}" class="button">View Your Digital Ticket</a>
          </div>
          <div class="warning">
            <strong style="color: #991b1b;">⚠️ IMPORTANT:</strong>
            <p style="margin: 10px 0 0 0; color: #991b1b;">College ID Card is MANDATORY for entry. You will not be allowed in without it.</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            <strong>Backup Ticket URL:</strong><br>
            <a href="${ticketUrl}" style="color: #8b4513;">${ticketUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    const transporter = createTransport({
      service: "gmail",
      auth: {
        user: Deno.env.get("GMAIL_USER"),
        pass: Deno.env.get("GMAIL_PASSWORD"),
      },
    });

    await transporter.sendMail({
      from: `"Farewell Party Team" <${Deno.env.get("GMAIL_USER")}>`,
      to: email,
      subject: subject,
      html: emailHtml,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent via Gmail" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send ticket", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});