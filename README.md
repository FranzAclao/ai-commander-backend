# AI Commander Backend

A powerful Node.js + Express backend service that powers AI-driven command and data insights. This is the backend API for the **AI Commander** suite, providing intelligent query processing, real-time voice integration, and seamless database management for enterprise-grade AI applications.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Integration](#api-integration)
- [Database Management](#database-management)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## 🎯 Overview

AI Commander Backend is a comprehensive REST API service designed to:

- **Process intelligent queries** using OpenAI or local Ollama LLM models
- **Manage conversational context** with in-memory turn-based conversation tracking
- **Enable real-time voice communication** via LiveKit integration
- **Persist data** with PostgreSQL and Sequelize ORM
- **Provide robust validation** using Joi schema validation
- **Scale with enterprise needs** through modular architecture

This backend serves the AI Commander frontend (React/Vite) and can be extended for additional intelligent command processing use cases.

## ✨ Features

### Core Capabilities

- **🤖 AI Query Processing**: Execute arbitrary queries against OpenAI GPT models or local Ollama instances
- **🎤 Real-time Voice Integration**: LiveKit integration for voice-based AI interactions and agent dispatch
- **💬 Conversation Management**: Maintain conversation history with configurable turn limits and TTL
- **🔐 Environment-based Configuration**: Flexible deployment across development, staging, and production
- **📊 PostgreSQL Database**: Persistent data storage with automatic migrations
- **✅ Input Validation**: Robust request validation using Joi schemas
- **🌐 CORS Support**: Configurable cross-origin resource sharing

### Optional Features

- **📡 LLM Pre-warming**: Reduce first-response latency by pre-warming Ollama on boot
- **🌱 Database Seeding**: Demo data scripts for rapid prototyping
- **🔄 Sequelize Migrations**: Version-controlled schema management

## 🛠️ Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | LTS |
| Framework | Express.js | 4.19.2 |
| Database | PostgreSQL | - |
| ORM | Sequelize | 6.37.7 |
| AI/LLM | OpenAI SDK | 6.34.0 |
| Real-time | LiveKit Server SDK | 2.15.1 |
| Validation | Joi | 17.13.3 |
| Config | dotenv | 16.4.5 |

## 📦 Prerequisites

- **Node.js**: LTS version or higher
- **PostgreSQL**: 12+ for database backend
- **npm or yarn**: Package manager
- **Optional**: Docker for containerized deployment

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/FranzAclao/ai-commander-backend.git
cd ai-commander-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your specific configuration (see [Configuration](#configuration) section).

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development`, `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/ai-commander` |

### Database Configuration

```env
# PostgreSQL
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/ai-commander
DB_SYNC=true              # Auto-create/alter tables (dev only)
LOG_SQL=false             # Log SQL queries for debugging
SQL_TIMEOUT_MS=5000       # Query timeout in milliseconds
```

### LLM Configuration (Choose One)

#### Option A: OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4       # or gpt-3.5-turbo
```

#### Option B: Local Ollama

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama2       # Run 'ollama pull <model>' first
OLLAMA_TIMEOUT_MS=60000
LLM_PREWARM=true          # Pre-warm on boot for faster first response
```

### Voice Features (LiveKit)

```env
LIVEKIT_URL=https://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
INSIGHTCOPILOT_AGENT_NAME=your-agent-name
```

### Other Configuration

```env
CORS_ORIGIN=http://localhost:5173    # Frontend URL
CONVERSATION_MAX_TURNS=12            # Max conversation history
CONVERSATION_TTL_MS=1800000          # 30 minutes
```

## 🏃 Running the Application

### Start the Server

```bash
npm start
```

The server will start on the configured `PORT` (default: 3000) and connect to PostgreSQL.

### Development Mode

For development with auto-reload:

```bash
npm install --save-dev nodemon
npx nodemon src/server.js
```

## 📚 API Integration

See `docs/FRONTEND_API_INTEGRATION_CHECKLIST.md` for comprehensive frontend integration guidelines.

### Key Endpoints

- **Query API**: `/api/query` - Process AI queries
- **Conversation API**: `/api/conversation` - Manage conversation context
- **LiveKit Token**: `/api/livekit/token` - Get voice session tokens
- **Agent Join**: `/api/agent/join` - Join voice agent room

## 🗄️ Database Management

### Initialize Database

```bash
# Auto-sync schema (development only)
npm start

# Or run migrations manually
npx sequelize-cli db:migrate
```

### Seed Demo Data

```bash
npm run seed
```

Loads sample data for development and testing.

### Database Migrations

This project uses Sequelize CLI for version-controlled migrations.

#### Create a New Migration

```bash
npx sequelize-cli migration:create --name add-new-field
```

#### Run Migrations

```bash
npm run db:migrate
```

#### Undo Last Migration

```bash
npm run db:migrate:undo
```

Migration files are stored in the `migrations/` directory.

## 📁 Project Structure

```
ai-commander-backend/
├── src/                      # Application source code
│   └── server.js            # Entry point
├── migrations/              # Sequelize migrations
├── seeders/                 # Database seeders
├── sequelize/              # Sequelize configuration
├── scripts/                # Utility scripts
├── docs/                   # Documentation
├── .env.example            # Example environment variables
├── .sequelizerc            # Sequelize CLI config
├── package.json            # Dependencies
└── README.md              # This file
```

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes and Test

```bash
npm start
# Test your endpoints
```

### 3. Commit and Push

```bash
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
```

### 4. Create a Pull Request

Open a PR on GitHub for code review.

## 📝 Available Scripts

```bash
npm start              # Start the server
npm run seed           # Seed demo data
npm run db:migrate     # Run database migrations
npm run db:migrate:undo  # Undo last migration
```

## 🐛 Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `psql --version`
- Check `DATABASE_URL` format: `postgres://user:password@host:port/database`
- Ensure database exists and user has permissions

### LLM Connection Issues

**OpenAI**: Verify `OPENAI_API_KEY` is valid and not expired

**Ollama**: 
- Ensure Ollama is running: `ollama serve`
- Pull the model: `ollama pull llama2`
- Check `OLLAMA_BASE_URL` is correct

### Port Already in Use

```bash
# Use a different port
PORT=3001 npm start

# Or find and kill the process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check existing documentation in the `docs/` folder
- Review the API integration checklist for frontend integration help

---

**Last Updated**: May 2026  
**Maintainer**: FranzAclao
