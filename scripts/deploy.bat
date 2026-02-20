@echo off
REM Arroyyan Deployment Script for Windows
REM Automates deployment to Cloudflare Workers

echo 🚀 Arroyyan Deployment Script
echo ==============================
echo.

REM Step 1: Install dependencies
echo 📦 Installing dependencies...
call bun install

REM Step 2: Run type check
echo 🔍 Running type check...
call bun run typecheck

REM Step 3: Run tests
echo 🧪 Running tests...
call bun test

REM Step 4: Deploy to Cloudflare
echo ☁️  Deploying to Cloudflare Workers...
call bun run deploy

REM Step 5: Apply D1 migrations
echo 🗄️  Applying D1 migrations...
call npx wrangler d1 migrations apply arroyyan-db --remote

echo.
echo ✅ Deployment complete!
echo 🌐 Visit: https://arroyyan.karnarupa.workers.dev

pause
