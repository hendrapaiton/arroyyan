#!/bin/bash

# Arroyyan Deployment Script
# Automates deployment to Cloudflare Workers

set -e

echo "🚀 Arroyyan Deployment Script"
echo "=============================="
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
bun install

# Step 2: Run type check
echo "🔍 Running type check..."
bun run typecheck

# Step 3: Run tests
echo "🧪 Running tests..."
bun test

# Step 4: Deploy to Cloudflare
echo "☁️  Deploying to Cloudflare Workers..."
bun run deploy

# Step 5: Apply D1 migrations
echo "🗄️  Applying D1 migrations..."
npx wrangler d1 migrations apply arroyyan-db --remote

echo ""
echo "✅ Deployment complete!"
echo "🌐 Visit: https://arroyyan.karnarupa.workers.dev"
