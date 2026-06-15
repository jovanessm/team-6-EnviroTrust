# EnviroTrust Frontend

A React + TypeScript web application for predicting renewable energy park lifetime output using satellite imagery and climate projections.

## Stack

- **React 18** with TypeScript
- **Vite** for fast development and builds
- **React Router** for navigation
- **Axios** for API requests

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables (copy from example):
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your backend API URL if needed (default: `http://localhost:5000/api`)

## Development

Start the dev server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Build

Create a production build:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/        # Reusable components (Header, etc.)
├── pages/            # Full page components (Home, ParkAnalysis, Results)
├── utils/            # Utilities (API client, etc.)
├── types.ts          # TypeScript interfaces
├── App.tsx           # Main app with routing
└── main.tsx          # Entry point
```

## Features

- **Home**: Landing page with overview and use cases
- **Park Analysis**: Search and select real wind/solar parks, configure climate scenarios
- **Results**: View lifetime output predictions with uncertainty ranges under different climate scenarios

## API Integration

The frontend communicates with a Python backend via REST API. See `src/utils/api.ts` for endpoints.

Expected backend endpoints:
- `GET /api/parks/search?q=<query>` - Search parks
- `GET /api/parks/<id>` - Get park details
- `POST /api/predict` - Run prediction with Monte Carlo

## Notes

- Uses Monte Carlo simulations for uncertainty quantification
- Displays results in honest ranges, not false-precision single numbers
- Supports multiple climate scenarios (historical, SSP2-4.5, SSP5-8.5)
