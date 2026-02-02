#!/bin/bash

echo "=========================================="
echo "Agriplast Polyhouse Planner - Setup"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it first."
    exit 1
fi

# Check if Mapbox token is configured
if grep -q "YOUR_MAPBOX_TOKEN_HERE" .env; then
    echo "⚠️  Warning: Mapbox token not configured in .env"
    echo "Please add your Mapbox token from: https://account.mapbox.com/access-tokens/"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Installing dependencies..."
echo ""

# Install shared types
echo "1/3 Installing shared types..."
cd shared && npm install && npm run build && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Failed to install shared dependencies"
    exit 1
fi

# Install backend
echo "2/3 Installing backend..."
cd backend && npm install && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Install frontend
echo "3/3 Installing frontend..."
cd frontend && npm install && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend && npm run dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "=========================================="
