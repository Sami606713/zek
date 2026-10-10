# 🛍️ ZIK - AI-Powered Shopping Assistant

> **Shop by Asking** - The future of e-commerce is conversational

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Latest-blue?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)](https://www.python.org/)

## 📖 Overview

**ZIK** is an agentic e-commerce platform that revolutionizes online shopping through AI-powered natural language interactions. Instead of browsing through endless product listings, users simply describe what they need in plain words - via **voice**, **text chat**, or **video** - and ZIK's intelligent agent finds the perfect products.

### 🎯 Key Features

- 🎤 **Voice Commerce** - Speak naturally, shop hands-free
- 💬 **Text Chat AI** - Conversational product discovery
- 📹 **Video Support** - Live visual assistance (coming soon)
- 🎴 **Visual Product Cards** - Beautiful, interactive product displays
- 🛒 **Smart Cart Management** - Quantity controls, instant checkout
- 📊 **Admin Dashboard** - Complete store management
- 🔄 **Multi-Channel Support** - Web, WhatsApp, Voice integration
- 🤖 **Advanced AI Agent** - Context-aware recommendations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         ZIK Platform                        │
├──────────────────┬──────────────────────┬───────────────────┤
│    Frontend      │      Backend         │   AI Agent        │
│    (Next.js)     │     (FastAPI)        │  (LangGraph)      │
├──────────────────┼──────────────────────┼───────────────────┤
│ • React 19       │ • Python 3.12        │ • LangChain       │
│ • Tailwind CSS   │ • PostgreSQL         │ • Agnes AI        │
│ • Zustand        │ • Alembic            │ • Custom Tools    │
│ • Motion         │ • Cloudinary         │ • Streaming       │
│ • TypeScript     │ • JWT Auth           │ • Multi-turn      │
└──────────────────┴──────────────────────┴───────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.12+
- **PostgreSQL** 14+
- **Git**

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd hackaton
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration:
# - DATABASE_URL
# - AGNES_API_KEY
# - JWT_SECRET
# - CLOUDINARY credentials (optional)

# Run database migrations
alembic upgrade head

# Seed the database with sample data
python -m scripts.seed

# Start the backend server
langgraph dev
```

The backend will be available at `http://localhost:2024`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
# or
yarn install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:2024/api/v1
# NEXT_PUBLIC_LANGGRAPH_API_URL=http://127.0.0.1:2024
# NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=chat

# Start the development server
npm run dev
# or
yarn dev
```

The frontend will be available at `http://localhost:3000`

## 📁 Project Structure

```
hackaton/
├── backend/
│   ├── src/
│   │   └── app/
│   │       ├── agent/           # AI Agent (LangGraph)
│   │       │   ├── agent.py     # Agent definition
│   │       │   ├── tools.py     # Search tools
│   │       │   ├── context/     # User context
│   │       │   └── middlewares/ # Auth middleware
│   │       ├── api/
│   │       │   └── v1/
│   │       │       ├── models/      # Database models
│   │       │       ├── routes/      # API endpoints
│   │       │       ├── schemas/     # Pydantic schemas
│   │       │       ├── services/    # Business logic
│   │       │       └── webhook/     # WhatsApp webhook
│   │       └── voices/          # Voice integration
│   ├── alembic/                 # Database migrations
│   ├── scripts/                 # Utility scripts
│   ├── langgraph.json          # LangGraph config
│   └── pyproject.toml
│
├── frontend/
│   ├── app/
│   │   ├── (shop)/             # Customer-facing pages
│   │   ├── (admin)/            # Admin dashboard
│   │   ├── (auth)/             # Authentication
│   │   └── (checkout)/         # Checkout flow
│   ├── components/
│   │   ├── agent/              # AI chat interface
│   │   ├── shop/               # Product components
│   │   ├── admin/              # Admin components
│   │   └── ai-elements/        # Reusable AI UI
│   ├── lib/
│   │   ├── api/                # API clients
│   │   ├── agent/              # Agent config
│   │   ├── catalog.ts          # Product helpers
│   │   └── pricing.ts          # Pricing logic
│   ├── store/                  # Zustand stores
│   └── public/                 # Static assets
│
└── ZIK-Pitch-Presentation.html # Investor presentation
```

## 🎨 Features in Detail

### 🤖 AI Shopping Agent

The core of ZIK is a sophisticated AI agent built with LangGraph that:

- **Understands Natural Language** - Processes user requests in plain English
- **Searches Products Intelligently** - Uses custom tools to query the product catalog
- **Provides Recommendations** - Context-aware suggestions based on user preferences
- **Handles Complex Queries** - Multi-turn conversations with memory
- **Supports Multiple Channels** - Web chat, voice, WhatsApp

**Example Conversation:**

```
User: "I need a film camera for a beginner, budget around $150"

ZIK:  "Great! I have some perfect options:

      🎁 Vela 35 Film Camera - $129
         - Manual focus, lightweight
         - Perfect for beginners
         - Currently on sale!

      Would you like to see more details or add it to your cart?"
```

### 🎴 Visual Product Cards

Products in the AI chat are displayed as beautiful, interactive cards:

- High-quality product images
- Real-time pricing with discounts
- Quantity increment/decrement controls
- Instant add-to-cart with quantity
- Smooth animations and hover effects
- Mobile-optimized design

### 📊 Admin Dashboard

Complete store management interface:

- **Products Management** - Add, edit, delete products with variants
- **Inventory Control** - Real-time stock tracking
- **Order Management** - View, process, and track orders
- **Customer Insights** - User analytics and behavior
- **Agent Analytics** - Conversation metrics and performance
- **Discount Management** - Create and manage promo codes

### 🛒 Shopping Experience

- **Smart Cart** - Persistent cart with quantity controls
- **Wishlist** - Save products for later
- **Checkout Flow** - Streamlined, secure checkout
- **Order Tracking** - Real-time order status
- **Reviews & Ratings** - Customer feedback system

## 🔧 API Documentation

### Product Search Endpoint

```http
GET /api/v1/products?q={query}&category={category}&min_price={min}&max_price={max}
```

### Agent Chat Endpoint (LangGraph)

```http
POST /chat
Content-Type: application/json

{
  "messages": [
    {
      "type": "human",
      "content": "Show me wireless keyboards under $50"
    }
  ]
}
```

### Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Full API documentation available at: `http://localhost:2024/docs`

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest
```

### Frontend Tests

```bash
cd frontend
npm run test
# or
yarn test
```

## 🚢 Deployment

### Backend Deployment (Docker)

```bash
cd backend
docker build -t zik-backend .
docker run -p 2024:2024 zik-backend
```

### Frontend Deployment (Vercel)

```bash
cd frontend
vercel deploy
```

### Environment Variables for Production

**Backend (.env):**
```env
DATABASE_URL=postgresql://user:pass@host/db
AGNES_API_KEY=your_agnes_key
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=https://api.zik.shop/api/v1
NEXT_PUBLIC_LANGGRAPH_API_URL=https://agent.zik.shop
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=chat
```

## 📊 Database Schema

Key entities:

- **Users** - Customer accounts with authentication
- **Products** - Product catalog with variants and images
- **Categories** - Product categorization
- **Collections** - Curated product collections
- **Orders** - Order processing and history
- **Cart** - Shopping cart items
- **Reviews** - Product reviews and ratings
- **Conversations** - AI agent chat history
- **Discounts** - Promo codes and offers

Run migrations:
```bash
alembic upgrade head
```

Create new migration:
```bash
alembic revision --autogenerate -m "description"
```

## 🎯 Roadmap

### Q1 2027
- [ ] Video call integration
- [ ] Multi-language support (5 languages)
- [ ] Advanced analytics dashboard
- [ ] 50+ brand partnerships

### Q2 2027
- [ ] AR product visualization
- [ ] Buy Now, Pay Later integration
- [ ] Personal style AI
- [ ] Native mobile apps (iOS/Android)

### Q3 2027
- [ ] Voice clone for brand personalities
- [ ] Predictive shopping AI
- [ ] International expansion
- [ ] Third-party seller marketplace

### Q4 2027
- [ ] Scale to 1M+ users
- [ ] Series A funding round
- [ ] Major industry partnerships
- [ ] Achieve profitability

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Frontend:** ESLint + Prettier (run `npm run lint`)
- **Backend:** Black + isort (run `black . && isort .`)

## 🐛 Troubleshooting

### Backend won't start

**Issue:** Port 2024 already in use
```bash
# Find and kill the process
lsof -i :2024
kill -9 <PID>
```

**Issue:** Database connection fails
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify DATABASE_URL in .env
- Run migrations: `alembic upgrade head`

### Frontend won't start

**Issue:** API connection fails
- Verify backend is running on port 2024
- Check NEXT_PUBLIC_API_URL in .env.local
- Try clearing Next.js cache: `rm -rf .next`

**Issue:** Images not loading
- External images need `unoptimized` prop
- Check image domains in next.config.ts
- Verify CORS settings in backend

### Agent not responding

**Issue:** Agent returns errors
- Check AGNES_API_KEY is valid
- Verify LangGraph server is running
- Check agent logs: `tail -f logs/agent.log`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

**ConnectXeo**

- **Samiullah** - Founder & Lead Developer
  - Full-stack engineer
  - AI/ML specialist
  - Product visionary

## 📞 Contact

- **Website:** [zik.shop](https://zik.shop)
- **Email:** contact@zik.shop
- **LinkedIn:** [linkedin.com/in/samiullah](https://linkedin.com/in/samiullah)
- **Demo:** [zik.shop/demo](https://zik.shop/demo)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [LangChain](https://langchain.com/) - AI agent framework
- [LangGraph](https://langchain-ai.github.io/langgraph/) - Agent orchestration
- [Agnes AI](https://agnes-ai.com/) - LLM provider
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [Motion](https://motion.dev/) - Animation library
- [PostgreSQL](https://www.postgresql.org/) - Database

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

**ZIK - Shop Smarter, Not Harder** 🛍️

*Built with ❤️ by ConnectXeo*
