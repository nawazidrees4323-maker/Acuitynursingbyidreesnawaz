import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { to, subject, body } = req.body;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return res.status(500).json({ error: "Email credentials not configured in environment." });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use STARTTLS
      auth: { user, pass },
    });

    console.log(`Vercel API: Attempting to send email to ${to}`);

    await transporter.sendMail({
      from: `"Acuity Nursing Academy" <${user}>`,
      to,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #2563eb;">${subject}</h2>
              <div style="line-height: 1.6; color: #444;">${body.replace(/\n/g, '<br>')}</div>
              <hr style="margin-top: 20px; border: 0; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999;">Sent from Acuity Nursing Academy Admin Panel</p>
            </div>`,
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Vercel Email Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
