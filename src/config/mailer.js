const nodemailer = require('nodemailer');

// ─── Environment check ──────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

// ─── Brevo HTTP API helper (shared with utils/email.js logic) ────────────────
// In production we bypass SMTP entirely and use Brevo's REST API over HTTPS,
// which is never blocked by Railway or similar PaaS providers.
const sendViaBrevoAPI = async (mailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set. Cannot send email via Brevo API.');
  }

  const fromRaw = mailOptions.from || process.env.MAIL_FROM || 'noreply@example.com';
  let senderName = 'Made in Egypt';
  let senderEmail = fromRaw;
  const fromMatch = fromRaw.match(/"?([^"<]*)"?\s*<([^>]+)>/);
  if (fromMatch) {
    senderName = fromMatch[1].trim();
    senderEmail = fromMatch[2].trim();
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: mailOptions.to }],
    subject: mailOptions.subject,
  };

  if (mailOptions.html) payload.htmlContent = mailOptions.html;
  if (mailOptions.text) payload.textContent = mailOptions.text;
  if (!payload.htmlContent && !payload.textContent) {
    payload.textContent = '(no content)';
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }

  return await response.json();
};

// ─── Build the exported transporter ──────────────────────────────────────────
// order.mailer.js calls `transporter.sendMail(mailOptions)` so we must
// export an object with that method.

let transporter;

if (isProduction) {
  // Production: wrap Brevo API in a transporter-compatible interface
  // so order.mailer.js works without any changes.
  transporter = {
    sendMail: async (mailOptions) => {
      // Attempt + 1 retry
      try {
        return await sendViaBrevoAPI(mailOptions);
      } catch (firstError) {
        console.error('[Mailer] First attempt failed (API):', firstError.message);
        await new Promise((r) => setTimeout(r, 2000));
        return await sendViaBrevoAPI(mailOptions);
      }
    },
    // verify() is called at startup — make it a safe no-op in production
    verify: (callback) => {
      if (typeof callback === 'function') {
        const hasKey = !!process.env.BREVO_API_KEY;
        callback(hasKey ? null : new Error('BREVO_API_KEY not set'), hasKey);
      }
    },
  };

  // Run startup check
  transporter.verify(function (error, success) {
    if (error) {
      console.log('Mail Server Connection Error:', error.message);
    } else {
      console.log('Mail Server is ready to take our messages (Brevo API)');
    }
  });
} else {
  // Development: use standard SMTP with proper timeouts
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Verify connection configuration (original behavior)
  transporter.verify(function (error, success) {
    if (error) {
      console.log('Mail Server Connection Error:', error);
    } else {
      console.log('Mail Server is ready to take our messages');
    }
  });
}

module.exports = transporter;
