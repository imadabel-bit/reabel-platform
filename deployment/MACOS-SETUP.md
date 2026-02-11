# 🍎 macOS SETUP (No Docker Required!)

## ✅ COMPLETE LOCAL SETUP FOR macOS

---

## OPTION 1: Quick Setup (Homebrew) - RECOMMENDED

### Step 1: Install PostgreSQL
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb reabel_platform
```

### Step 2: Install Node.js
```bash
# Install Node.js (if not already installed)
brew install node

# Verify
node --version  # Should be 18+
npm --version   # Should be 9+
```

### Step 3: Setup Database
```bash
cd REABEL-PRODUCTION

# Load schema
psql reabel_platform < database/schema.sql

# Load seed data (demo users)
psql reabel_platform < database/seeds.sql
```

### Step 4: Setup Backend
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=reabel_platform
DB_USER=$USER
DB_PASSWORD=
JWT_SECRET=your-secret-key-for-development
CORS_ORIGIN=http://localhost:8000
EOF

# Start backend
npm start
```

You should see:
```
✅ Server running on port 3000
✅ Database connected
```

### Step 5: Setup Frontend
```bash
# Open new terminal
cd REABEL-PRODUCTION/frontend

# Update config to use local backend
# Edit: config/app.config.js
# Change:
dataSources: {
    mode: 'api',
    api: {
        baseUrl: 'http://localhost:3000/api/v1'
    }
}

# Start frontend
python3 -m http.server 8000
```

### Step 6: Open Browser
```
http://localhost:8000/pages/01_login.html
```

**Login:**
- Email: admin@reabel.com
- Password: admin123

---

## OPTION 2: Using Postgres.app (Mac-Friendly GUI)

### Step 1: Install Postgres.app
1. Download from https://postgresapp.com/
2. Drag to Applications
3. Open Postgres.app
4. Click "Initialize" to create server

### Step 2: Setup Database
```bash
# Postgres.app adds psql to PATH
# Create database
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb reabel_platform

# Load schema
/Applications/Postgres.app/Contents/Versions/latest/bin/psql reabel_platform < database/schema.sql
```

### Step 3: Continue with backend & frontend setup (same as Option 1, steps 4-6)

---

## TROUBLESHOOTING

### "psql: command not found"
```bash
# Add PostgreSQL to PATH
echo 'export PATH="/usr/local/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "npm: command not found"
```bash
# Install Node.js
brew install node
```

### "Database connection failed"
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start it if stopped
brew services start postgresql@15

# Check connection
psql postgres
```

### "Port 3000 already in use"
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port in .env
PORT=3001
```

### "CORS errors in browser"
- Make sure backend is running on port 3000
- Check CORS_ORIGIN in backend .env matches frontend URL
- Try hard refresh: Cmd+Shift+R

---

## VERIFY EVERYTHING WORKS

### Test Backend:
```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"success":true,"status":"healthy",...}

# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@reabel.com","password":"admin123"}'

# Should return token and user data
```

### Test Frontend:
1. Open http://localhost:8000/pages/01_login.html
2. Click "Admin" role
3. Should see dashboard with sidebar
4. Click navigation items - should work
5. Open browser console (Cmd+Option+I) - no errors

---

## STOP SERVICES

```bash
# Stop PostgreSQL
brew services stop postgresql@15

# Stop backend
# Press Ctrl+C in terminal

# Stop frontend
# Press Ctrl+C in terminal
```

---

## NEXT STEPS

Once working locally, deploy to cloud:
- See RAILWAY.md for Railway.app deployment
- See VERCEL.md for Vercel deployment
- See RENDER.md for Render.com deployment

**No Docker needed for any of these!**
