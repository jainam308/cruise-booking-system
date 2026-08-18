# Cruise Booking System

A full-stack cruise holiday booking system built with **React (Vite)**, **Node.js/Express**, and **MongoDB**.

## Features
- Browse available cruises
- Configure passengers (adults + children with ages) and optional extras
- Full itemised price breakdown before confirmation
- One promotional code per booking (validated against date, usage limits, minimum spend)
- Atomic capacity and promo-usage enforcement (no overselling, no overuse)
- Immutable order snapshot — every booking is permanently reconstructable

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Testing | Jest + Supertest |

## Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally on `mongodb://localhost:27017` (or set `MONGO_URI` in `.env`)

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run seed      # seed cruises, promos, pricing rules
npm run dev       # start dev server on :4000
npm test          # run all tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # start Vite on :5173
```

## Project Docs
- [BusinessRequirements.md](./BusinessRequirements.md)
- [TechnicalApproach.md](./TechnicalApproach.md)
- [UnitTestCases.md](./UnitTestCases.md)

## Status
🚧 In active development — see [TechnicalApproach.md](./TechnicalApproach.md) for current status.
