import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API routes
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const { default: nodemailer } = await import("nodemailer");

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return res.status(500).json({ error: "Email credentials not configured in environment (EMAIL_USER, EMAIL_PASS)." });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use STARTTLS
      auth: { user, pass },
    });

    console.log(`Attempting to send email to ${Array.isArray(to) ? to.join(', ') : to}`);

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

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Email error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function setupApp() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if this file is run directly (not as a module)
  if (process.env.NODE_ENV !== 'production' || process.env.PORT) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupApp();

export default app;
