# ⛽ Fuel Price Tracker

A full-stack system that scrapes daily Indian fuel prices, uses **Groq AI** to
parse raw HTML into structured data, stores results in **MongoDB**, and serves
them via a REST API to your frontend app.

---

## Architecture

```
mypetrolprice.com
      │  (HTML fetch via axios)
      ▼
 webScraper.js      ← strips noise, trims to Groq context limit
      │
      ▼
 groqParser.js      ← Groq LLaMA3 extracts structured JSON
      │
      ▼
 priceValidator.js  ← bounds check, dedup, normalise
      │
      ▼
   MongoDB
   ├── fuel_prices      (latest per state, upserted)
   ├── price_history    (append-only, 180-day TTL)
   └── scrape_runs      (run log)
      │
      ▼
 Express REST API   → Frontend (React)
```

---

## Project Structure

```
fuel-price-tracker/
├── .env.example
├── package.json          ← workspace root
│
├── scraper/
│   ├── config/index.js
│   ├── src/
│   │   ├── index.js           ← entry, cron scheduler
│   │   ├── scrapeRunner.js    ← orchestrates full pipeline
│   │   ├── models/index.js    ← Mongoose schemas
│   │   ├── scrapers/
│   │   │   └── webScraper.js  ← axios + cheerio
│   │   ├── parsers/
│   │   │   └── groqParser.js  ← Groq API call
│   │   ├── validators/
│   │   │   └── priceValidator.js
│   │   └── utils/
│   │       ├── logger.js
│   │       └── dbWriter.js    ← upsert + history write
│   └── package.json
│
├── api/
│   ├── src/
│   │   ├── index.js           ← Express server
│   │   ├── routes/prices.js
│   │   ├── controllers/pricesController.js
│   │   └── utils/logger.js
│   └── package.json
│
└── frontend/
    └── src/
        └── hooks/useFuelPrices.js   ← React hooks
```

---

## Step-by-Step Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Groq API key → https://console.groq.com

---

### Step 1 — Clone & Install

```bash
git clone <your-repo>
cd fuel-price-tracker
npm install          # installs all workspaces
```

---

### Step 2 — Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
MONGODB_URI=mongodb://localhost:27017/fuel_tracker
```

Leave other values as defaults to start.

---

### Step 3 — Start MongoDB

**Local:**
```bash
mongod --dbpath ~/data/db
```

**Or use Docker:**
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

**Or use MongoDB Atlas** — paste your connection string into `.env`.

---

### Step 4 — Test a Single Scrape

Before setting up the cron, verify the pipeline works end-to-end:

```bash
npm run scrape:now
```

You should see logs like:
```
[INFO]: Fetching all-states page...
[INFO]: Page fetched and cleaned { originalLength: 180000, cleanedLength: 14000 }
[INFO]: Sending to Groq for parsing... { model: 'llama3-70b-8192' }
[INFO]: Groq parsing complete { statesFound: 28 }
[INFO]: Validation complete { total: 28, valid: 26, invalid: 2 }
[INFO]: Price saved { state: 'Maharashtra', petrol: 104.21, diesel: 92.15 }
[INFO]: ═══ Scrape run complete ═══ { saved: 26, skipped: 0 }
```

Check MongoDB:
```bash
mongosh fuel_tracker
db.fuelprices.find().pretty()
```

---

### Step 5 — Start the Scraper (with cron)

```bash
npm run dev:scraper
```

This runs a scrape immediately and then again at **7 AM and 6 PM** every day
(configurable via `SCRAPE_SCHEDULE` in `.env`).

---

### Step 6 — Start the API

In a new terminal:

```bash
npm run dev:api
```

Test it:
```bash
# All states
curl http://localhost:4000/api/prices/latest

# Single state
curl http://localhost:4000/api/prices/Maharashtra

# History (last 30 days)
curl http://localhost:4000/api/prices/Maharashtra/history?days=30

# Last scrape run info
curl http://localhost:4000/api/prices/runs/latest
```

---

### Step 7 — Frontend Integration

```bash
cd frontend
npx create-react-app . --template typescript  # or your preferred setup
```

Copy `src/hooks/useFuelPrices.js` into your project, then use:

```jsx
import { useFuelPrices } from './hooks/useFuelPrices';

function PriceTable() {
  const { prices, loading, error, lastUpdated, refetch } = useFuelPrices();

  if (loading) return <p>Loading prices...</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div>
      <p>Last updated: {lastUpdated?.toLocaleTimeString()}</p>
      <button onClick={refetch}>Refresh</button>
      <table>
        <thead>
          <tr><th>State</th><th>Petrol (₹/L)</th><th>Diesel (₹/L)</th></tr>
        </thead>
        <tbody>
          {prices.map(p => (
            <tr key={p.state}>
              <td>{p.state}</td>
              <td>{p.petrol_price ?? '—'}</td>
              <td>{p.diesel_price ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Set your env var:
```env
REACT_APP_API_URL=http://localhost:4000/api
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices/latest` | All states, latest prices |
| GET | `/api/prices/:state` | Single state price |
| GET | `/api/prices/:state/history` | Price history (`?days=30&limit=30`) |
| GET | `/api/prices/runs/latest` | Last scrape run status |
| GET | `/health` | Health check |

---

## Customising the Scrape Schedule

Edit `SCRAPE_SCHEDULE` in `.env` using cron syntax:

```
"0 7,18 * * *"   → 7 AM and 6 PM daily  (default)
"0 */6 * * *"    → every 6 hours
"0 9 * * *"      → once a day at 9 AM
```

---

## Troubleshooting

**Groq returns invalid JSON**
- Increase `MAX_HTML_CHARS` if the page was cut off
- Try `llama3-70b-8192` instead of 8b for better extraction accuracy

**0 valid prices after validation**
- The source page structure may have changed — check `logs/combined.log`
- Try fetching the URL manually and inspecting the HTML

**MongoDB connection refused**
- Ensure `mongod` is running: `sudo systemctl start mongod`
- Or check your Atlas connection string

---

## Production Checklist

- [ ] Use PM2 to keep scraper and API alive: `pm2 start src/index.js`
- [ ] Add Redis caching to API (reduces DB load on popular endpoints)
- [ ] Set up MongoDB Atlas for managed hosting
- [ ] Add a `/api/prices/latest` response cache (already has `Cache-Control: max-age=1800`)
- [ ] Monitor scrape failures via `scrape_runs` collection
- [ ] Add alerting if no successful scrape in 24h
