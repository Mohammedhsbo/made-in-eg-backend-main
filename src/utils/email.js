const nodemailer = require('nodemailer');

// ─── Brevo HTTP API sender (production) ──────────────────────────────────────
// Uses Brevo's REST API over HTTPS (port 443), which is never blocked by
// platform providers like Railway that may restrict SMTP ports 465/587.
const sendViaBrevoAPI = async (mailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set. Cannot send email via Brevo API.');
  }

  // Parse "from" field — supports both '"Name" <email>' and plain email
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

  // Include html and/or text content
  if (mailOptions.html) {
    payload.htmlContent = mailOptions.html;
  }
  if (mailOptions.text) {
    payload.textContent = mailOptions.text;
  }
  // Brevo requires at least one content field
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

// ─── SMTP sender (development / fallback) ────────────────────────────────────
// Creates a fresh transporter with proper timeouts to avoid hanging connections.
const sendViaSMTP = async (mailOptions) => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    // Timeouts to fail fast instead of hanging
    connectionTimeout: 10000, // 10s to establish connection
    greetingTimeout: 10000,   // 10s for SMTP greeting
    socketTimeout: 15000,     // 15s for socket inactivity
  });

  return transporter.sendMail(mailOptions);
};

// ─── Main sendEmail function (unchanged signature) ───────────────────────────
// Called as: sendEmail({ email, subject, message, html })
// This is the ONLY export — all existing callers continue to work as-is.
const sendEmail = async (options) => {
  const mailOptions = {
    from: process.env.MAIL_FROM || '"Admin" <admin@example.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const isProduction = process.env.NODE_ENV === 'production';
  const send = isProduction ? sendViaBrevoAPI : sendViaSMTP;

  // Attempt 1
  try {
    await send(mailOptions);
    return;
  } catch (firstError) {
    console.error(`[Email] First attempt failed (${isProduction ? 'API' : 'SMTP'}):`, firstError.message);
  }

  // Retry once after a short delay
  try {
    await new Promise((r) => setTimeout(r, 2000));
    await send(mailOptions);
    console.log('[Email] Retry succeeded.');
  } catch (retryError) {
    console.error('[Email] Retry also failed:', retryError.message);
    // Re-throw so callers that catch errors can handle it (e.g. forgotPassword)
    throw retryError;
  }
};

module.exports = sendEmail;
