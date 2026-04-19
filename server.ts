import express from "express";
import path from "path";
import { fileURLToPath } from "url";

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
      return res.status(500).json({ error: "Email credentials not configured." });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, 
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Acuity Nursing Academy" <${user}>`,
      to,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #2563eb;">${subject}</h2>
              <p>${body.replace(/\n/g, '<br>')}</p>
            </div>`,
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function setupApp() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import to prevent production crashes
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupApp();
export default app;
