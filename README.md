# 💍 Digital Wedding E-Invitation Platform (ប្រព័ន្ធសំបុត្រអាពាហ៍ពិពាហ៍ឌីជីថល)

A luxurious, interactive digital wedding invitation and guest RSVP management system inspired by [E-Theap (អុី ធៀប)](https://e-theap.com). Designed with the signature **Bronze & Gold (#4E3227)** luxury aesthetic, authentic Cambodian wedding traditions, bilingual support (Khmer & English), and engineered to be **exceptionally easy to host anywhere**.

---

## ✨ Features (លក្ខណៈពិសេស)

### 💌 1. Interactive E-Invitation Experience (ទំព័រសំបុត្រអញ្ជើញ)
* **Interactive Envelope & Wax Seal**: Unfolds smoothly upon tapping the golden wax seal with realistic animations.
* **Personalized Guest Invitation**: Displays the specific guest's name on the envelope and invitation header (e.g. `?to=Mr.+Sok+Dara` -> *"សូមគោរពអញ្ជើញ លោក សុខ ដារ៉ា និងភរិយា"*).
* **Floating Romantic Music Player**: Plays background romantic wedding music with a rotating vinyl record button and play/pause toggle.
* **Falling Golden Petals Animation**: Ambient festive particles for a magical luxury experience.
* **Bilingual Support (Khmer & English)**: 1-click instant language switcher with traditional Khmer fonts (*Moul*, *Kantumruy Pro*, *Siemreap*) and English luxury serif fonts (*Cinzel*, *Great Vibes*, *Playfair Display*).
* **Couple & Parents Honor Section**: Traditional Khmer layout honoring both Groom's parents and Bride's parents.
* **Live Countdown Timer**: Real-time days, hours, minutes, and seconds countdown to the wedding day.
* **Solar & Lunar Dates**: Displays both Western solar date and traditional Khmer lunar date (e.g., *ថ្ងៃសៅរ៍ ៥រោច ខែកត្តិក ឆ្នាំរោង ឆស័ក ព.ស. ២៥៧០*).
* **Venue & Navigation**: Venue details, embedded Google Map, 1-click **"Open in Google Maps"** navigation, and **"Add to Google Calendar"**.
* **Ceremony Agenda Timeline**: Morning traditional ceremonies (*Hai Chomnoun, Ancestral blessing, Hair cutting, Wrist-tying*) and evening reception banquet.
* **Pre-Wedding Photo Gallery & Video**: High-res photo grid with full-screen zoom lightbox and video teaser.
* **Digital Gifting (ចងដៃឌីជីថល - KHQR / ABA Pay / Bakong)**: Dedicated Groom & Bride QR cards with 1-click **"Copy Account Number"** and **"Download QR"**.
* **Interactive RSVP Form**: Guests can submit attendance status, number of attendees (Pax), phone number, and personalized blessings.
* **Live Wishes Guestbook (សៀវភៅជូនពរ)**: Real-time public message wall showcasing guest congratulations.

---

### 🛠️ 2. Comprehensive Admin Dashboard (ផ្ទាំងគ្រប់គ្រងរៀបចំពិធី)
Accessible at `/admin` (Default credentials: `username: admin` | `password: admin123`):
* **Real-time Overview Metrics**: Total guests, Confirmed attendees, Declined, Headcount (Pax count for catering), Total wishes.
* **Guest List & Invitation Link Generator**:
  * Add single guests or **Bulk Import** comma/newline separated names.
  * Generates unique personalized invitation links.
  * **1-Click Share via Telegram** (with pre-composed Khmer invitation message).
  * **1-Click Share via WhatsApp**.
  * **1-Click Print QR Code**: Generates individual high-resolution QR codes to print and stick on physical envelopes or greeting stands.
  * **Export to CSV / Excel**: Download complete guest list and RSVP status for catering and event planners.
* **Wedding Information & Theme Editor**:
  * Customize Groom & Bride details, parents' names, photos, and romantic quotes.
  * Change color theme with 1 click (Bronze `#4E3227`, Royal Gold `#C5A059`, Wine Red `#722F37`, Emerald `#2D5A27`, or custom color).
  * Update dates, venue address, Google Maps link, music audio URL, and video embed.
* **Agenda Timeline Builder**: Add, edit, reorder, or delete ceremony events.
* **Gallery Manager**: Add or remove pre-wedding photos.
* **Digital Gift KHQR Settings**: Set ABA / Bakong / ACLEDA bank account names, numbers, and upload QR images.
* **Guestbook Moderator**: Review and delete inappropriate messages.

---

## 🚀 Easy Hosting Guide (ការបង្ហោះ និង ដាក់ឱ្យដំណើរការ)

This project is built with **pure Node.js & Express** with zero external database dependencies (uses atomic JSON storage). It can be hosted **100% free** in less than 3 minutes.

### Option 1: Free 1-Click Hosting on Render.com (Recommended)
1. Push this project folder to your **GitHub** account.
2. Go to [Render.com](https://render.com) and click **"New +"** -> **"Web Service"**.
3. Connect your GitHub repository.
4. Set:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **"Deploy Web Service"** — Render gives you a free live HTTPS URL (e.g., `https://your-wedding.onrender.com`)!

---

### Option 2: Free Serverless on Vercel
1. Install Vercel CLI or go to [Vercel.com](https://vercel.com).
2. Run in terminal:
   ```bash
   npx vercel --prod
   ```
   *(Pre-configured `vercel.json` is already included in the project).*

---

### Option 3: cPanel Shared Hosting (Hostinger, Namecheap, or Local Cambodian Hosts)
Almost all cPanel hosts support Node.js via **"Setup Node.js App"**:
1. Compress this project folder into a `.zip` (excluding `node_modules`).
2. Log into your cPanel -> open **File Manager** -> upload and extract into your folder (e.g. `e-invitation`).
3. In cPanel, search for **"Setup Node.js App"**.
4. Click **"Create Application"**:
   - **Node.js version**: Choose `18.x`, `20.x`, or `22.x`
   - **Application root**: `e-invitation`
   - **Application URL**: `yourdomain.com` or `invitation.yourdomain.com`
   - **Application startup file**: `server.js`
5. Click **"Create"**, then click **"Run NPM Install"**, and then **"Restart Application"**. Done!

---

### Option 4: Run Locally or on VPS (Docker / Ubuntu)

#### Run locally:
```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```
Visit:
- Public Invitation: `http://localhost:3000`
- Personalized Sample: `http://localhost:3000/?to=Lok_Oknha_Sok`
- Admin Dashboard: `http://localhost:3000/admin` (admin / admin123)

#### Run with Docker:
```bash
docker compose up -d
```

---

## 📁 Project Structure (រចនាសម្ព័ន្ធឯកសារ)

```
E-Invitation/
├── data/
│   ├── wedding-data.json     # All wedding details, theme colors, agenda, bank info
│   ├── guests.json           # Guest list, RSVP statuses, pax counts
│   └── wishes.json           # Guestbook messages and blessings
├── public/
│   ├── index.html            # Main E-Invitation card & interactive experience
│   ├── admin.html            # Admin management dashboard
│   ├── login.html            # Admin login screen
│   ├── css/
│   │   └── style.css         # Luxury styling, wax seal 3D animation, golden borders
│   ├── js/
│   │   ├── invitation.js     # Frontend logic, envelope opening, audio, RSVP, countdown
│   │   └── admin.js          # Admin dashboard controller, links generator, CSV exporter
│   ├── images/               # Sample QR codes and decorative assets
│   ├── audio/                # Romantic background wedding music
│   └── uploads/              # Custom uploaded photos and QR codes
├── server.js                 # Express server with REST API, QR generator, CSV export
├── Dockerfile                # Docker production container
├── docker-compose.yml        # Docker compose file
├── vercel.json               # Vercel deployment configuration
└── package.json              # Project dependencies & scripts
```

---

## 🔒 Security Note
To change the default admin credentials, update the `admin` object inside [wedding-data.json](file:///d:/Narak/E-Invitation/data/wedding-data.json) or manage it via the admin panel.

---

© 2026 Digital Wedding E-Invitation Platform. Inspired by [E-Theap (អុី ធៀប)](https://e-theap.com).
