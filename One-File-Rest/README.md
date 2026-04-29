# Elite Tok Club - TikTok Appeal Management Platform

A comprehensive full-stack application for managing TikTok account appeals with AI-powered features, real-time messaging, and advanced analytics.

## 🚀 Features

### Core Features
- **Discord OAuth Authentication** - Seamless Discord login integration
- **Real-time Messaging** - Socket.io powered live chat between clients and support
- **Case Management** - Complete appeal lifecycle management
- **Evidence Management** - Upload and organize appeal evidence
- **Compliance Scoring** - 12-factor compliance calculation system
- **Deadline Tracking** - Automatic deadline monitoring and alerts

### AI Features
- **Appeal Draft Generation** - AI-powered appeal writing assistance
- **Outcome Prediction** - ML-based case outcome prediction
- **Image Analysis** - Computer vision for evidence analysis
- **Auto-reply Suggestions** - Smart response recommendations

### Admin Features
- **Dashboard Analytics** - Real-time system metrics
- **Client Management** - View and manage all clients
- **Case Management** - Monitor all cases across the system
- **Template Builder** - Create reusable appeal templates
- **Bulk Broadcasting** - Segment-targeted messaging
- **Policy Management** - TikTok policy database
- **Staff Management** - Role-based access control

### Real-time Features
- **Live Notifications** - Real-time alerts and updates
- **Message Mirroring** - Discord integration for messages
- **Status Updates** - Live case status changes
- **Deadline Alerts** - Urgent deadline notifications

## 📁 Project Structure

```
├── server/
│   ├── src/
│   │   ├── routes/          # Express API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── db/              # Database layer
│   │   └── ai/              # Groq AI integration
│   ├── schema.sql           # Database schema
│   └── migrate.ts           # Database migration
│
├── client/
│   ├── src/
│   │   ├── pages/           # React pages
│   │   │   ├── admin/       # Admin dashboard pages
│   │   │   └── client/      # Client pages
│   │   ├── components/      # Reusable components
│   │   │   ├── messaging/   # Chat components
│   │   │   ├── case/        # Case components
│   │   │   ├── evidence/    # Evidence components
│   │   │   ├── policy/      # Policy components
│   │   │   ├── admin/       # Admin components
│   │   │   ├── ai/          # AI components
│   │   │   └── charts/      # Chart components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities and helpers
│   │   └── App.tsx          # Main app component
│   └── package.json
│
├── package.json             # Root dependencies
├── tsconfig.json            # TypeScript config
├── .replit                  # Replit config
└── Procfile                 # Deployment config
```

## 🛠️ Tech Stack

### Backend
- **Node.js + Express** - REST API server
- **PostgreSQL** - Primary database
- **Socket.io** - Real-time communication
- **Groq AI** - AI/ML features
- **Discord.js** - Discord bot integration
- **TypeScript** - Type safety

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Socket.io Client** - Real-time updates

### Infrastructure
- **Replit** - Hosting platform
- **PostgreSQL** - Database
- **Discord OAuth** - Authentication

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Discord Bot Token
- Groq API Key

### Installation

1. **Clone and setup**
```bash
git clone <repo>
cd Elite-Tok-Club
npm install
```

2. **Environment Variables**
```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost/elite_tok
DISCORD_CLIENT_ID=your_id
DISCORD_CLIENT_SECRET=your_secret
GROQ_API_KEY=your_key
SESSION_SECRET=your_secret
NODE_ENV=development
```

3. **Database Setup**
```bash
npm run migrate
```

4. **Start Development**
```bash
npm run dev
```

5. **Build for Production**
```bash
npm run build
npm start
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/login` - Discord OAuth login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Cases
- `GET /api/cases` - List all cases
- `POST /api/cases` - Create new case
- `GET /api/cases/:id` - Get case details
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### Messages
- `GET /api/cases/:caseId/messages` - Get case messages
- `POST /api/cases/:caseId/messages` - Send message
- `DELETE /api/messages/:id` - Delete message

### Evidence
- `GET /api/cases/:caseId/evidence` - List evidence
- `POST /api/cases/:caseId/evidence` - Upload evidence
- `DELETE /api/evidence/:id` - Delete evidence

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Analytics
- `GET /api/analytics` - System analytics
- `GET /api/analytics/clients` - Client analytics
- `GET /api/analytics/clients/:id` - Client details

### Admin
- `POST /api/broadcast` - Send broadcast
- `GET /api/policies` - List policies
- `POST /api/policies` - Create policy

## 🎨 Component Library

### Hooks
- `useAuth()` - Authentication state management
- `useSocket()` - Real-time socket connection
- `useNotifications()` - Toast notifications

### Components

#### Messaging
- `MessageBubble` - Individual message display
- `MessageThread` - Message conversation
- `MessageInput` - Message input form

#### Cases
- `CaseCard` - Case summary card
- `StatusBadge` - Status indicator
- `ComplianceScore` - Compliance display
- `DeadlineCountdown` - Deadline timer
- `CaseTimeline` - Case event timeline

#### Evidence
- `EvidenceUploader` - File upload component
- `EvidenceGrid` - Evidence gallery
- `EvidenceViewer` - Evidence preview

#### AI
- `AIDraftPanel` - Appeal draft generator
- `OutcomePredictor` - Case outcome prediction
- `ImageAnalyzer` - Image analysis tool

#### Admin
- `TemplateEditor` - Template creation
- `DeadlineAlertRow` - Deadline alert item
- `BroadcastComposer` - Broadcast message composer

#### Charts
- `ViolationHistoryChart` - Violation timeline chart

## 🔐 Security Features

- Discord OAuth 2.0 authentication
- Session-based authorization
- Role-based access control (RBAC)
- SQL injection prevention
- CSRF protection
- Rate limiting
- Input validation
- Secure password hashing

## 📊 Database Schema

### Users
- id, discord_id, discord_username, email, role, avatar_url, created_at

### Cases
- id, client_id, account_username, violation_type, status, priority, appeal_deadline, created_at

### Messages
- id, case_id, sender_id, content, type, created_at

### Evidence
- id, case_id, file_url, file_type, file_name, uploaded_at

### Templates
- id, name, content, variables, created_at

### Policies
- id, title, content, severity, created_at

### Compliance Scores
- id, case_id, score, factors, calculated_at

## 🤖 AI Integration

### Groq AI Features
- **Text Generation** - Appeal drafts, responses
- **Vision Analysis** - Evidence image analysis
- **JSON Parsing** - Structured data extraction
- **Fast Models** - Low-latency responses

## 📱 Real-time Features

### Socket.io Events
- `case:join` - Join case room
- `case:leave` - Leave case room
- `message:send` - Send message
- `message:receive` - Receive message
- `case:update_status` - Update case status
- `notification:send` - Send notification

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# E2E testing
npm run test:e2e
```

## 📈 Performance

- Optimized database queries with indexing
- Redis caching for frequently accessed data
- Socket.io connection pooling
- Image optimization and lazy loading
- Code splitting and lazy route loading
- Gzip compression

## 🚀 Deployment

### Replit Deployment
1. Connect GitHub repository
2. Set environment variables
3. Run `npm run migrate`
4. Deploy with `npm start`

### Docker Deployment
```bash
docker build -t elite-tok-club .
docker run -p 3000:3000 elite-tok-club
```

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

For support, email support@elitetokclub.com or open an issue on GitHub.

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Machine learning model improvements
- [ ] Multi-language support
- [ ] API rate limiting dashboard
- [ ] Custom branding options
- [ ] Webhook integrations
- [ ] Advanced reporting

---

**Built with ❤️ for TikTok creators**
