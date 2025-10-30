UNI10 E-Commerce — Vite + React + Express + MongoDB
<img width="1854" height="910" alt="image" src="https://github.com/user-attachments/assets/7c99361e-5355-4346-abbf-4b07e20e8958" />

A full-stack e-commerce app with a modern React (Vite + TypeScript + Tailwind + shadcn/ui) frontend and an Express + MongoDB backend. It includes authentication, catalog, cart/checkout, orders, wishlist & reviews, coupons, invoices, basic CMS pages, support tickets, and Razorpay-based payments.

Heads-up: This README is based on the codebase inside the attached project. If you renamed the project, replace “UNI10” with your brand.

✨ Features

Frontend (React + Vite + TS)

Product listing, collections, product detail pages

Cart, wishlist, checkout, order success

Auth (login/signup/forgot), user dashboard (profile, orders, shipments)

Static/help pages (Help Center, Returns, Shipping, Contact)

Shadcn/ui components, TailwindCSS styling

Client-side API helper with VITE_API_BASE_URL and /api fallback

Backend (Node.js + Express + MongoDB)

JWT auth (httpOnly cookie + Authorization header support)

Products, categories, reviews, wishlist

Orders & invoices

Coupons

Support tickets

File uploads (Multer) served from /uploads

Razorpay integration (env or DB-settings)

Nodemailer (Gmail) email utilities

CORS with allow-list & sensible previews

Seeds an admin and a demo user on first connect (see Security)

🧱 Tech Stack

Frontend: Vite 5, React 18, TypeScript, TailwindCSS, shadcn/ui, React Router, TanStack Query, Recharts

Backend: Node.js, Express, Mongoose/MongoDB, Multer, Razorpay SDK, JSON Web Tokens, Nodemailer

Dev & Quality: ESLint, PostCSS, Autoprefixer

📁 Folder Structure (trimmed)
project_un2/
  index.html
  package.json
  tailwind.config.ts
  vite.config.ts
  public/
  server/
    index.js
    package.json
    middleware/
    models/
    routes/
    uploads/
      ...
    utils/
  src/
    App.tsx
    assets/
    components/
    contexts/
    data/
    hooks/
    integrations/
    lib/
    pages/
    styles/
    types/

🚀 Getting Started (Local)
1) Requirements

Node.js 18+ (recommended 20 LTS)

MongoDB Atlas URI

(Optional) Razorpay account for payments

(Optional) Gmail account (app password) for emails

2) Clone & Install
npm i

3) Environment Variables

Create two env files:

Root .env (used by Vite frontend helper):

# Points the frontend to your API. In local dev, backend runs at 5000.
VITE_API_BASE_URL="http://localhost:5000"


Server .env (inside server/):

PORT=5000
MONGODB_URI="your-mongodb-uri"
JWT_SECRET="a-strong-random-secret"

# Razorpay (optional – can also be stored in DB Settings)
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

# Email (optional)
GMAIL_USER="your@gmail.com"
GMAIL_PASSWORD="your-app-password"


Note: The repo includes server/.env.example with minimal values. Use the fuller set above for production.

4) Run in Development

One command (concurrent):

npm run dev


This starts:

Backend: server/index.js on port 5000

Frontend: Vite dev server on port 8080

If the single command fails on Windows, run in two terminals:
Terminal A: node server/index.js
Terminal B: vite

Vite is configured to proxy /api and /uploads to http://localhost:5000.

5) Build Frontend
npm run build


Outputs the production frontend bundle to dist/. (Backend is plain Node.js; no build step required.)

🔐 Security & Defaults

On first successful DB connect, the backend seeds:

Admin user: uni10@gmail.com / 12345678

Demo user: sachin@gmail.com / 123456

Change or remove this seeding logic before going live:
File: server/index.js (search adminEmail, adminPassword, demoEmail, demoPassword)

Auth token lives in an httpOnly cookie and can also be passed via Authorization: Bearer <token>.

💳 Payments (Razorpay)

The backend reads Razorpay keys from:

Environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET), and/or

DB Settings (model: SiteSetting → razorpay block)

Relevant files:

server/routes/payment.js

server/models/SiteSetting.js

Webhook (optional): set RAZORPAY_WEBHOOK_SECRET and expose /api/payment/webhook (if you add one).

✉️ Email (Nodemailer / Gmail)

Config in server/utils/emailService.js

Use Gmail App Password with GMAIL_USER and GMAIL_PASSWORD.

🔌 API Base URL Logic (Frontend)

src/lib/api.ts:

Uses VITE_API_BASE_URL when available.

If VITE_API_BASE_URL points to localhost and the site is not running on localhost, it falls back to relative /api automatically.
Handy when the frontend is on the same domain that reverse-proxies the API.

🧩 Key Routes (Frontend)

/ — Home

/shop, /shop/new-arrivals, /products

/collection/:slug, /product/:id

/cart, /checkout, /orders/success

/auth, /forgot-password, /dashboard

/wishlist

/help-center, /returns, /shipping, /contact

/support (tickets)

/admin (admin dashboard), /admin/login, /admin/returns, /admin/invoice

File: src/App.tsx

🛠️ Useful NPM Scripts
"dev": "node server/index.js & vite",
"build": "vite build",
"lint": "eslint .",
"preview": "vite preview"

🖼️ Static & Uploads

Multer stores uploads under server/uploads/

Served at /uploads and /api/uploads
(so the frontend can access images via either path)

🌐 Production Deployment (VPS + Nginx example)

Start backend with PM2:

cd server
pm2 start index.js --name uni10-api
pm2 save


Serve frontend statically (e.g., Nginx) after npm run build.

Reverse proxy /api and /uploads to Node (5000). Example Nginx block:

location /api/ {
  proxy_pass http://127.0.0.1:5000/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}

location /uploads/ {
  proxy_pass http://127.0.0.1:5000/uploads/;
  proxy_set_header Host $host;
}


In production, set VITE_API_BASE_URL to your API base (or serve frontend + proxy /api and rely on relative mode).

🧪 Smoke Test Checklist

GET /api/health returns { ok: true }

Sign up/login works (/auth)

Create product/category (admin)

Add to cart → checkout → Razorpay order created

Order stored, invoice generated

Wishlist & reviews functional

Uploads visible under /uploads/...

🐞 Troubleshooting

Mongo connect fails → check MONGODB_URI and VPS firewall.

JWT errors → ensure JWT_SECRET is set; delete stale cookie, re-login.

CORS blocked → update the allow-list in server/index.js (look for allowed array & regex).

Payment failing → set Razorpay keys in env/DB; confirm currency INR; check server logs.

Images 404 → ensure Nginx proxies /uploads to the Node server path above.

Windows dev → run backend & Vite in separate terminals if npm run dev doesn’t start both.


<img width="1919" height="920" alt="image" src="https://github.com/user-attachments/assets/bb89a900-331d-4199-bef9-152deab1381f" />




📜 License

Proprietary. All rights reserved.
(Replace with MIT or your preferred license if open-sourcing.)

🙌 Credits

UI components: shadcn/ui

Icons: lucide-react

Charts: recharts

Scaffolding: Vite + TypeScript
