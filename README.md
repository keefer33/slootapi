# slootAPI

**Backend API for [sloot.ai](https://sloot.ai)**

slootAPI is the robust backend service powering [sloot.ai](https://sloot.ai), providing a comprehensive REST API for AI agent management, tool execution, authentication, and more.

## 🌐 About

slootAPI serves as the core backend infrastructure for [sloot.ai](https://sloot.ai), enabling seamless integration with multiple AI providers, tool execution, payment processing, and user management. Built with Express.js and TypeScript, it provides a scalable and maintainable foundation for the Sloot platform.

Visit **[sloot.ai](https://sloot.ai)** to experience the full platform.

## 🚀 Features

- **Multi-AI Provider Support** - Integration with Anthropic, OpenAI, Google Gemini, and xAI
- **Tool Execution** - Execute custom tools and integrations including Pipedream workflows
- **Authentication & Authorization** - JWT-based authentication with secure user management
- **Payment Processing** - Integrated payment handling for subscriptions and usage
- **Coolify Integration** - Server and resource management through Coolify
- **Flux Image Generation** - Multiple Flux model endpoints for image generation
- **Streaming Support** - Real-time streaming responses for chat completions
- **Webhook Support** - Webhook endpoints for external integrations
- **Security** - Helmet.js for security headers, CORS configuration
- **Logging** - Morgan HTTP request logger
- **TypeScript** - Full type safety and modern JavaScript features

## 📁 Project Structure

```
slootapi/
├── src/
│   ├── config/              # Configuration files
│   ├── controllers/         # Request handlers
│   │   ├── authController.ts
│   │   ├── agentController.ts
│   │   ├── toolsController.ts
│   │   ├── paymentController.ts
│   │   ├── chat/           # Chat completion handlers
│   │   ├── anthropic/      # Anthropic-specific handlers
│   │   ├── openai/         # OpenAI-specific handlers
│   │   └── utils/          # Utility controllers
│   ├── middleware/         # Express middleware
│   │   ├── auth.ts
│   │   ├── jwtAuth.ts
│   │   └── getAgent.ts
│   ├── routes/             # API route definitions
│   │   ├── authRoutes.ts
│   │   ├── agentRoutes.ts
│   │   ├── toolsRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   ├── accountRoutes.ts
│   │   ├── coolify/        # Coolify integration routes
│   │   └── tools/          # Tool-specific routes
│   ├── utils/              # Utility functions
│   │   ├── agentUtils.ts
│   │   ├── runToolUtils.ts
│   │   ├── streamingUtils.ts
│   │   └── supabaseClient.ts
│   ├── types/              # TypeScript type definitions
│   └── index.ts            # Main application entry point
├── package.json
├── env.example             # Environment variables template
└── README.md
```

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd slootapi
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

## 📡 API Endpoints

### Health Check

- `GET /api/healthcheck` - Server health status

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token

### AI Agents

- `POST /api/agents` - Create and manage AI agents
- `POST /api/agents/anthropic` - Anthropic Claude agent endpoints
- `POST /api/agents/openai` - OpenAI agent endpoints
- `POST /api/agents/gemini` - Google Gemini agent endpoints
- `POST /api/agents/xai` - xAI agent endpoints

### Tools

- `GET /api/tools` - List available tools
- `POST /api/tools/execute` - Execute a tool
- `POST /api/flux/*` - Flux image generation endpoints

### Payments

- `POST /api/payments` - Payment processing endpoints

### Account Management

- `GET /api/account` - Get account information
- `GET /api/account/apikeys` - Manage API keys

### Coolify Integration

- `GET /api/coolify/resources` - Manage Coolify resources
- `GET /api/coolify/applications` - Manage Coolify applications
- `GET /api/coolify/databases` - Manage Coolify databases
- `GET /api/coolify/servers` - Manage Coolify servers
- `GET /api/coolify/services` - Manage Coolify services
- `GET /api/coolify/user-databases` - Manage user databases

### Webhooks

- `POST /api/webhooks` - Webhook endpoints for external integrations

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Database Configuration
DATABASE_URL=your-database-connection-string

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key

# AI Provider API Keys
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
XAI_API_KEY=your-xai-key

# Pipedream Configuration
PIPEDREAM_API_KEY=your-pipedream-key

# Payment Configuration
STRIPE_SECRET_KEY=your-stripe-secret-key
```

## 🚀 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Check for linting issues
- `npm run lint:fix` - Automatically fix linting issues
- `npm run format` - Format all files with Prettier
- `npm run format:check` - Check if files are properly formatted
- `npm run check` - Run both linting and format checking

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **JWT Authentication** - Token-based authentication
- **Input Validation** - Request data validation
- **Error Handling** - Secure error responses
- **Environment Variables** - Secure configuration management

## 📊 Response Format

All API responses follow a consistent format:

**Success Response:**

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## 🎨 Code Quality

This project uses **ESLint** and **Prettier** for code quality and formatting.

### Available Scripts

```bash
# Linting
npm run lint          # Check for linting issues
npm run lint:fix      # Automatically fix linting issues

# Formatting
npm run format        # Format all files with Prettier
npm run format:check  # Check if files are properly formatted

# Combined check
npm run check         # Run both linting and format checking
```

### Configuration Files

- **`.prettierrc`** - Prettier configuration
- **`.prettierignore`** - Files to ignore during formatting
- **`eslint.config.js`** - ESLint configuration (v9 format)
- **`.vscode/settings.json`** - VS Code integration settings

### VS Code Integration

The project includes VS Code settings for automatic formatting and linting:

- **Format on Save** - Automatically format files when saving
- **ESLint Integration** - Show linting errors and warnings in real-time
- **Prettier as Default Formatter** - Use Prettier for all formatting

### Recommended Extensions

Install these VS Code extensions for the best development experience:

- **Prettier - Code formatter** (`esbenp.prettier-vscode`)
- **ESLint** (`dbaeumer.vscode-eslint`)

### Code Style

The project follows these code style guidelines:

- **Single quotes** for strings
- **Semicolons** at the end of statements
- **2 spaces** for indentation
- **80 characters** line length
- **Trailing commas** in objects and arrays
- **No unused variables** (use `_` prefix for intentionally unused variables)

## 🔄 Development

### Adding New Routes

1. Create a new route file in `src/routes/`
2. Create corresponding controller in `src/controllers/`
3. Import and use the route in `src/routes/index.ts`

### Adding Middleware

1. Create middleware in `src/middleware/`
2. Import and use in routes or main app

### Adding New AI Providers

1. Create provider-specific controller in `src/controllers/[provider]/`
2. Add route handler in `src/routes/agentRoutes.ts`
3. Implement streaming and response handling utilities

## 🗄️ Database Integration

The API uses Supabase for database operations. Configure your Supabase credentials in the `.env` file:

```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-anon-key
```

## 🧪 Testing

```bash
npm test
```

## 📝 TODO

- [ ] Add comprehensive API documentation (Swagger/OpenAPI)
- [ ] Add unit and integration tests
- [ ] Add Docker configuration
- [ ] Add CI/CD pipeline
- [ ] Add rate limiting
- [ ] Add request validation middleware
- [ ] Add monitoring and logging infrastructure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🔗 Links

- **[sloot.ai](https://sloot.ai)** - Visit the Sloot platform

## 📄 License

MIT License - see LICENSE file for details
