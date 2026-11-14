# ThreatLedger — Production Deployment Guide (Vercel, Supabase & Cloudflare R2)

This deployment guide covers the end-to-end production deployment of ThreatLedger to **Vercel** backed by **Supabase PostgreSQL** and **Cloudflare R2** private object storage.

---

## 1. Supabase PostgreSQL Setup

1. Log in to [Supabase Console](https://supabase.com/dashboard) and create a new project.
2. Under **Project Settings -> Database**:
   - Note your database password.
   - Under **Connection String**, select **Prisma** or **Node.js**:
     - **Session / Direct Connection (Port 5432):** Use for `DIRECT_URL`.
     - **Transaction / Pooled Connection (Port 6543, pgbouncer):** Use for `DATABASE_URL`.
3. In local terminal or CI/CD, apply the schema to Supabase:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. Verify all tables (`UserProfile`, `RansomwareGroup`, `Assignment`, `ReportVersion`, `SupportingEvidence`, `Notification`, `AuditLog`, `EmailOutbox`) are created in Supabase Table Editor.

---

## 2. Cloudflare R2 Private Bucket & CORS Setup

ThreatLedger uses **Direct-to-R2 upload architecture** where analysts stream research deliverables and supporting evidence directly from browser to R2 via presigned PUT URLs.

### 2.1 Bucket Creation
1. In Cloudflare Dashboard, navigate to **R2 -> Create Bucket**.
2. Set bucket name to `threatledger-storage` (or your chosen name).
3. **Public Access Hardening:** Ensure **R2.dev subdomain** and **Custom Domains** remain **Disabled**. ThreatLedger mandates 100% private storage.

### 2.2 API Tokens Generation
1. Under **R2 -> Manage R2 API Tokens**, click **Create API Token**.
2. Permissions: **Object Read & Write**.
3. Specify bucket: `threatledger-storage`.
4. Copy:
   - `Access Key ID`
   - `Secret Access Key`
   - `Jurisdiction Endpoint` (e.g., `https://<account_id>.r2.cloudflarestorage.com`)

### 2.3 CORS Configuration for Direct Browser Uploads
Under **R2 Bucket Settings -> CORS Policy**, apply the following configuration:
```json
[
  {
    "AllowedOrigins": [
      "https://*.vercel.app",
      "https://threatledger.yourdomain.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 3. Email Provider Setup (Resend / SMTP)

ThreatLedger requires email delivery for:
- User invitations (`renderTeamInviteEmail`)
- Task allocations (`renderTaskAssignedEmail`)
- **Section 31 Physical Report Submissions** with binary MIME attachments (`renderReportSubmittedEmail`)
- Reviewer sign-off decisions (`renderReviewVerdictEmail`)

### Option A: Resend (Recommended)
1. Sign up at [Resend](https://resend.com) and create an API key (`re_...`).
2. Add and verify your sending domain (DNS TXT/MX records for SPF & DKIM).
3. Set environment variable: `RESEND_API_KEY=re_...`.

### Option B: SMTP (Corporate Relay / Postfix / Sendgrid)
Set:
- `SMTP_HOST=smtp.yourrelay.com`
- `SMTP_PORT=587`
- `SMTP_USER=your_user`
- `SMTP_PASSWORD=your_password`
- `SMTP_FROM="ThreatLedger CTI <notifications@yourdomain.com>"`

---

## 4. Vercel Deployment

1. Push your repository to GitHub or GitLab.
2. In [Vercel Dashboard](https://vercel.com), click **Add New -> Project** and import repository.
3. **Project Settings:**
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `next build`
   - Output Directory: `.next`
4. **Environment Variables Configuration:**
   Add the following variables in Vercel Project Settings:

| Variable | Description | Example / Note |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL | `https://threatledger.yourdomain.com` |
| `DATABASE_URL` | Supabase pooled connection (pgbouncer) | `postgresql://postgres:[PW]@[HOST]:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct connection | `postgresql://postgres:[PW]@[HOST]:5432/postgres` |
| `JWT_SECRET` | 64+ char secret key for auth tokens | Run `openssl rand -base64 48` |
| `RANSOMWARE_LIVE_API_KEY` | Ransomware.live PRO API Key | `live_pro_...` |
| `GITHUB_TOKEN` | GitHub PAT for secondary monitoring | `ghp_...` |
| `R2_ACCOUNT_ID` | Cloudflare Account ID | `<32_hex_chars>` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key ID | `<32_hex_chars>` |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key | `<64_hex_chars>` |
| `R2_BUCKET_NAME` | R2 bucket name | `threatledger-storage` |
| `R2_ENDPOINT` | R2 endpoint URL | `https://<account_id>.r2.cloudflarestorage.com` |
| `RESEND_API_KEY` | Resend API Key (if using Resend) | `re_...` |
| `SMTP_FROM` | Outgoing sender identity | `ThreatLedger CTI <notifications@yourdomain.com>` |

5. Click **Deploy**. Vercel will build the optimized production output.

---

## 5. Automated Intelligence Sync via Vercel Cron

ThreatLedger includes `vercel.json` to trigger scheduled baseline and incremental synchronization every 30 minutes:

```json
{
  "crons": [
    {
      "path": "/api/sync/run",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

---

## 6. Post-Deployment Verification Checklist

1. **Bootstrap Super Admin:** Navigate to `/setup` on your deployed domain. Enter full name, email, and master password. Confirm Super Admin account is initialized and setup route locks down.
2. **First Intelligence Sync:** Log in, navigate to `/monitoring`, and click **Sync Now**. Verify groups and victims are populated into database.
3. **Allocate Research Task:** Navigate to `/assignments`, click **New Assignment**, assign a syndicate to an analyst.
4. **Checklist & Deliverable Upload:** As analyst, open `/my-tasks/[id]`, complete checklist items, and upload a test PDF report. Verify file transfers directly to Cloudflare R2 bucket.
5. **Section 31 Physical MIME Attachment:** Submit report for review. Verify reviewer receives an email containing the actual binary report file attached as a MIME attachment.
6. **Section 35 Review Sign-off:** As reviewer, navigate to `/review-queue`, open the submission, and click **Approve Report**. Confirm assignment status transitions to `APPROVED_COMPLETED` with distinct reviewer metadata.
7. **Audit Trail Inspection:** Navigate to `/audit-logs` and confirm all events were recorded in immutable log format.
