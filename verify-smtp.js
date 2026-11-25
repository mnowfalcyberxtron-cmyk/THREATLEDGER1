const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Pool } = require('pg');

const senderEmail = 'threatledgerarchive@gmail.com';
const appPassword = 'sjlynzcccjgefqhd';
const encryptionKeyHex = '318bf568a309d67576be713eb08c79a88e8729180fbe349ec388842e76fb4201';

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKeyHex, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

async function main() {
  console.log('Testing SMTP connection to smtp.gmail.com:465 with', senderEmail);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: senderEmail,
      pass: appPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.verify();
    console.log('>>> SUCCESS: Gmail SMTP connection verified successfully!');
  } catch (err) {
    console.error('>>> SMTP Verify Failed:', err.message);
    process.exit(1);
  }

  // Encrypt and save to PostgreSQL
  const { encrypted, iv, tag } = encrypt(appPassword);
  const pool = new Pool({
    connectionString: 'postgresql://threatintel_app:TipLocalDb_2026!Guard%2347@127.0.0.1:5432/threatintel_local?schema=threatledger'
  });

  const existing = await pool.query('SELECT id FROM threatledger."EmailConfiguration" LIMIT 1');
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE threatledger."EmailConfiguration"
       SET "senderEmail" = $1, "encryptedAppPassword" = $2, "encryptionIv" = $3, "encryptionTag" = $4,
           "status" = 'CONNECTED', "lastTestedAt" = NOW(), "lastSuccessAt" = NOW(), "lastErrorMessage" = NULL, "updatedAt" = NOW()
       WHERE id = $5`,
      [senderEmail, encrypted, iv, tag, existing.rows[0].id]
    );
    console.log('Updated existing EmailConfiguration in DB.');
  } else {
    await pool.query(
      `INSERT INTO threatledger."EmailConfiguration"
       (id, "senderEmail", "senderDisplayName", "encryptedAppPassword", "encryptionIv", "encryptionTag", "status", "lastTestedAt", "lastSuccessAt", "maxAttachmentBytes", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'ThreatLedger', $2, $3, $4, 'CONNECTED', NOW(), NOW(), 18874368, NOW(), NOW())`,
      [senderEmail, encrypted, iv, tag]
    );
    console.log('Inserted new EmailConfiguration record into DB.');
  }

  // Send a test email to the user!
  console.log('Sending live test email to', senderEmail);
  const info = await transporter.sendMail({
    from: `"ThreatLedger CTI" <${senderEmail}>`,
    to: senderEmail,
    subject: 'ThreatLedger — Live Mail Dispatch System Verified',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #060a12; color: #f1f5f9; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
        <h2 style="color: #10b981; margin-top: 0;">ThreatLedger CTI — Mail Delivery Verified</h2>
        <p>This automated verification confirms that your <strong>ThreatLedger CTI platform</strong> has successfully connected to Google's SMTP servers using your dedicated App Password.</p>
        <div style="background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #334155; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Sender Account:</strong> ${senderEmail}</p>
          <p style="margin: 4px 0;"><strong>Connection:</strong> smtp.gmail.com:465 (TLS/SSL)</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #10b981; font-weight: bold;">CONNECTED & ACTIVE</span></p>
          <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">All threat report deliverables and supporting evidence files submitted by analysts will now be physically attached and immutably archived in your Gmail Sent mailbox.</p>
      </div>
    `,
  });

  console.log('>>> Test email dispatched successfully! Message ID:', info.messageId);

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

