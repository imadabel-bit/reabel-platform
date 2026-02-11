# Railway Deployment Configuration

## railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}

## Services to Create:

### 1. Backend Service
- **Build Command:** `cd backend && npm install`
- **Start Command:** `cd backend && npm start`
- **Port:** 3000
- **Environment Variables:**
  ```
  NODE_ENV=production
  PORT=3000
  DB_HOST=${{Postgres.PGHOST}}
  DB_PORT=${{Postgres.PGPORT}}
  DB_NAME=${{Postgres.PGDATABASE}}
  DB_USER=${{Postgres.PGUSER}}
  DB_PASSWORD=${{Postgres.PGPASSWORD}}
  JWT_SECRET=your-secret-key-change-this
  CORS_ORIGIN=https://your-frontend.up.railway.app
  ```

### 2. PostgreSQL Database
- Click "New" → "Database" → "Add PostgreSQL"
- Railway automatically provides connection strings

### 3. Frontend Service
- **Build Command:** `echo "Static files"`
- **Start Command:** `npx serve frontend -l 8080`
- **Port:** 8080

## One-Click Deploy:
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

## After Deployment:
1. Railway provides URLs for each service
2. Update frontend config with backend URL
3. Run database migrations
4. Access your app!

**Cost:** FREE $5/month credit, then ~$10-20/month
