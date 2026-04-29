import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Elite Tok Club API',
      version: '1.0.0',
      description: 'TikTok Shop violation recovery portal with real-time Discord sync, AI-powered appeals, compliance scoring, and admin dashboard',
      contact: {
        name: 'Elite Tok Club Support',
        email: 'support@elitetokclu.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.elitetokclu.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie for authentication',
        },
      },
      schemas: {
        Case: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_discord_id: { type: 'string' },
            account_username: { type: 'string' },
            violation_type: { type: 'string', enum: ['content_violation', 'copyright', 'fraud', 'harassment', 'misinformation', 'spam', 'other'] },
            violation_description: { type: 'string' },
            status: { type: 'string', enum: ['open', 'in_progress', 'won', 'denied', 'closed'] },
            priority: { type: 'string', enum: ['normal', 'high', 'critical'] },
            appeal_deadline: { type: 'string', format: 'date-time' },
            outcome: { type: 'string', enum: ['won', 'denied', null] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            case_id: { type: 'integer' },
            sender_discord_id: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['user', 'staff', 'system'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Evidence: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            case_id: { type: 'integer' },
            file_url: { type: 'string' },
            file_type: { type: 'string' },
            file_name: { type: 'string' },
            description: { type: 'string' },
            uploaded_at: { type: 'string', format: 'date-time' },
          },
        },
        ComplianceScore: {
          type: 'object',
          properties: {
            score: { type: 'integer', minimum: 0, maximum: 100 },
            grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
            trend: { type: 'string' },
            factors: { type: 'object' },
            recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: [
    './server/routes/cases.ts',
    './server/routes/messages.ts',
    './server/routes/evidence.ts',
    './server/routes/templates.ts',
    './server/routes/policies.ts',
    './server/routes/broadcast.ts',
    './server/routes/analytics.ts',
    './server/routes/subscriptions.ts',
    './server/routes/compliance.ts',
    './server/routes/ai.ts',
  ],
};

export const specs = swaggerJsdoc(options);
