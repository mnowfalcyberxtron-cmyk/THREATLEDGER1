# ThreatLedger — Enterprise Cyber Threat Intelligence (CTI) Monitoring Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.6-black?logo=next.js)](https://nextjs.org/)
[![Turbopack](https://img.shields.io/badge/Turbopack-Ready-blueviolet)](https://turbo.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma 7](https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma)](https://www.prisma.io/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-Private_Storage-F38020?logo=cloudflare)](https://developers.cloudflare.com/r2/)

ThreatLedger is a mission-critical, enterprise-grade Cyber Threat Intelligence (CTI) monitoring and analyst operations platform. Designed for commercial SOCs, incident response teams, and national CERT entities, ThreatLedger automates the continuous surveillance of active ransomware syndicates, coordinates deep analyst investigations through standardized checklists, manages multi-version report deliverables in private Cloudflare R2 object storage, and guarantees cryptographically verifiable governance.

---

## 🛡️ Core Architectural Pillars & Compliance Standards

### 1. Section 31 Compliance — Physical MIME Document Delivery
- **Strict Prohibition on Link Substitution:** When an analyst submits an intelligence report for formal evaluation, ThreatLedger's serverless dispatch engine fetches the exact binary bytes from private Cloudflare R2 storage and packages the physical document as a MIME attachment.
- Public URLs, expiring links, or external hosting proxies are forbidden for report delivery dispatches.

### 2. Section 35 Decoupling — Submission ≠ Approval
- **Cryptographic Separation of Roles:** An analyst submitting an intelligence deliverable is structurally prevented from approving their own research.
- Dedicated reviewer queues track independent evaluation verdicts (`APPROVED`, `CHANGES_REQUESTED`, `REJECTED`) with separate timestamps (`submittedAt` vs `approvedAt`), designated reviewers (`reviewedById`), and version progression history.

### 3. Section 26 — Standardized 15-Point Research Checklist
Every assigned syndicate investigation enforces a standardized quality control workflow:
1. Threat Syndicate Overview & Origins
2. Ransomware Family Lineage & Variants
3. MITRE ATT&CK TTP Mapping
4. Initial Access Vector Analysis
5. Lateral Movement & Privilege Escalation Techniques
6. Defense Evasion & Anti-Forensics
7. Exfiltration Protocols & Data Leak Site (DLS) Infrastructure
8. Cryptographic Ransom Mechanism & Note Artifacts
9. Associated Common Vulnerabilities & Exposures (CVEs)
10. Target Sector & Geographic Distribution
11. Known Victim Enumeration & Claim Verification
12. Dark Web Forums & Negotiation Channels
13. Indicators of Compromise (IOCs) Curation
14. Defensive Detection Rules (YARA / Sigma)
15. Remediation & Hardening Guidance
*Items marked as `NOT_APPLICABLE` require mandatory documented operational justification.*

### 4. Regional Standard — Asia/Kolkata (IST, UTC+5:30)
- All user-facing clocks, audit logs, and calendar boundaries are synchronized to `Asia/Kolkata`.
- "Newly Detected" syndicates are determined by calendar month boundaries evaluated in Indian Standard Time (1st of month at 00:00:00 IST to last day of month at 23:59:59 IST).

---

## ⚡ Feature Matrix

| Domain | Capabilities |
| :--- | :--- |
| **Intelligence Feeds** | Continuous ingestion from `https://api-pro.ransomware.live` (`X-API-KEY`) and GitHub upstream monitoring (`JMousqueton/ransomware.live`). Baseline sync prevents false positives on first run. |
| **Syndicate Profiles** | Comprehensive dossiers featuring historical victim counts, active/inactive states, known aliases, MITRE TTPs, CVEs, tools, and merge protocols for re-branded syndicates. |
| **Analyst Operations** | Bulk and individual task allocation with batch IDs, interactive 15-point quality checklist, two-way notes (Analyst/Reviewer shared vs Admin-only private notes). |
| **Private Object Storage** | Direct browser-to-R2 presigned upload architecture (bypassing Vercel request limits), short-lived download authorization (900s TTL), and progressive quota monitoring (70% notice, 85% warning, 95% hard-block). |
| **Supporting Evidence** | Dedicated private repository for victim datasets, screenshots, network graphs, and raw PCAP/IOC files with SHA-256 fingerprinting. |
| **Quality Governance** | Reviewer Sign-off Queue, version progression (`v1`, `v2`, etc.), revision feedback channels, and immutable append-only audit trail. |
| **Analytics & Telemetry** | Monthly discovery trends, victim industry sector breakdowns, country spread, analyst throughput metrics, and CSV/JSON export engine. |

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js `v20+` or `v22+`
- PostgreSQL database (or Supabase project)
- Cloudflare R2 bucket (optional for local mock testing)

### 2. Installation
```bash
git clone <repository_url>
cd threatledger
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```env
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PostgreSQL / Supabase
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Authentication
JWT_SECRET="generate-a-strong-random-64-char-string"

# Threat Intelligence APIs
RANSOMWARE_LIVE_API_KEY="your_ransomware_live_api_key"
GITHUB_TOKEN="your_github_personal_access_token"

# Cloudflare R2 Storage (Direct-to-R2)
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="threatledger-storage"
R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"

# Email Delivery (SMTP or Resend)
SMTP_HOST="smtp.resend.com"
SMTP_PORT=587
SMTP_USER="resend"
SMTP_PASSWORD="re_your_resend_api_key"
SMTP_FROM="ThreatLedger CTI <notifications@yourdomain.com>"
RESEND_API_KEY="re_your_resend_api_key"
```

### 4. Database Setup & Prisma Client
```bash
npx prisma generate
npx prisma db push
```

### 5. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
- If first run: navigate to `/setup` to bootstrap the initial Super Admin account.

### 6. Automated Test Suite
```bash
npm test
```
Executes comprehensive end-to-end tests across all operational phases:
- Phase 1: Security, Bcrypt, Invites, RBAC, Asia/Kolkata formatting
- Phase 2: Monthly discovery boundaries, baseline engine, group merge
- Phase 3: 15-point checklist, Section 34/35 governance, private notes
- Phase 4: R2 object keys, extension validation, Section 35 decoupling
- Phase 5: Branded email templates, Section 31 MIME buffer attachment delivery, idempotency
- Phase 6: Monthly trends, RFC 4180 CSV export escaping, quota alerts
- Phase 7: Quota engine tiers (70/85/95%), capacity overflow protection, 900s TTL

---

## 📜 License
Internal CTI Operational Platform — Proprietary & Confidential.
All rights reserved.
