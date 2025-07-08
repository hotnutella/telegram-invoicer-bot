# Supabase Setup Instructions

## ✅ What's Already Done

1. **Storage Bucket**: ✅ Created successfully (`invoice-pdfs`)
2. **Environment Variables**: ✅ Added to `.env` file
3. **Database Models**: ✅ Updated for async/await and PostgreSQL
4. **Migration Scripts**: ✅ Created for data transfer

## 🔧 Manual Steps Required

### Step 1: Create Database Schema

1. **Go to Supabase Dashboard**
   - Open: https://app.supabase.com
   - Select your project: `qcnsnmqkykmcikplcihs`

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Schema**
   - Copy the contents of `src/database/schema.sql`
   - Paste into the SQL editor
   - Click "RUN" to create all tables

### Step 2: Get Database Connection URL

1. **In Supabase Dashboard**
   - Go to Settings → Database
   - Scroll to "Connection info"
   - Copy the connection string

2. **Update .env file**
   - Add the DATABASE_URL line:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.qcnsnmqkykmcikplcihs.supabase.co:5432/postgres
   ```
   - Replace `[YOUR_PASSWORD]` with your actual database password

### Step 3: Test the Setup

```bash
# Test the connection
npm run setup-supabase

# If you have existing data, migrate it
npm run migrate

# Test the bot
npm run dev
```

## 📋 Next Steps for Production

### Option A: Deploy to Railway

1. **Connect to Railway**
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository
   - Deploy automatically

2. **Set Environment Variables in Railway**
   - Add all variables from your `.env` file
   - Set `NODE_ENV=production`

### Option B: Deploy with Docker

```bash
# Build and run locally
npm run docker:build
npm run docker:run

# Or deploy to any container platform
```

## 🔄 Development Workflow

```bash
# Local development (SQLite)
npm run dev

# Test with PostgreSQL
DATABASE_URL=postgresql://... npm run dev

# Build for production
npm run build

# Deploy
git push origin main  # Auto-deploys to Railway
```

## 🏗 Architecture Overview

```
Telegram Bot (Railway) ←→ Supabase PostgreSQL (Database)
                      ↕
                   Supabase Storage (PDF Files)
```

## 💰 Cost Estimate

- **Supabase**: Free tier (sufficient for this bot)
- **Railway**: ~$5/month for bot hosting
- **Total**: ~$5/month

## 🔒 Security Notes

- All API keys are properly configured
- Database uses Row Level Security (RLS)
- Storage bucket has appropriate permissions
- Bot runs in secure container environment

## 📞 Support

If you encounter issues:
1. Check the setup steps above
2. Verify all environment variables are set
3. Test database connection with `npm run setup-supabase`
4. Review logs for specific error messages