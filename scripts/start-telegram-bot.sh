#!/bin/bash

# Start Telegram Bot - requires environment variables configured
# Usage: bash scripts/start-telegram-bot.sh

echo "🤖 Starting Telegram Bot..."

# Check required environment variables
REQUIRED_VARS=("TELEGRAM_BOT_TOKEN" "ALERTLY_API_BASE_URL" "INTERNAL_API_KEY" "DATABASE_URL")

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: Missing required environment variable: $var"
    echo "⚠️  Add these secrets in the Replit secrets tab"
    exit 1
  fi
done

echo "✅ All environment variables configured"
echo "📡 Connecting to API: $ALERTLY_API_BASE_URL"
echo "🔗 Telegram Bot: $TELEGRAM_BOT_TOKEN"

cd /home/runner/workspace/telegram-bot

# Run the bot
if command -v npx &> /dev/null; then
  echo "Starting bot with npx ts-node..."
  npx ts-node src/bot.ts
else
  echo "Starting bot with node..."
  node src/bot.js
fi
