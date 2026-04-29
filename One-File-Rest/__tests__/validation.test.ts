import {
  createCaseSchema,
  updateCaseSchema,
  createMessageSchema,
  createEvidenceSchema,
  createTemplateSchema,
  updateTemplateSchema,
  createPolicySchema,
  updatePolicySchema,
  broadcastSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  complianceScoreSchema,
  analyticsQuerySchema,
  getOrCreateTokenSchema,
  revokeAccessSchema,
  checkAccessSchema,
} from '../server/utils/validation';

describe('Validation Schemas', () => {
  describe('createCaseSchema', () => {
    it('should validate valid case data', () => {
      const validData = {
        accountUsername: 'tiktok_user',
        violationType: 'content_violation',
        violationDescription: 'This is a detailed description of the violation',
        appealDeadline: '2025-12-31T23:59:59Z',
        totalGMV: 5000,
        faceVideosPosted: 10,
        commissionFrozen: false,
        accountPurchaseDate: '2024-01-01'
      };

      const result = createCaseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid violation type', () => {
      const invalidData = {
        accountUsername: 'tiktok_user',
        violationType: 'invalid_type',
        violationDescription: 'Description'
      };

      const result = createCaseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short description', () => {
      const invalidData = {
        accountUsername: 'tiktok_user',
        violationType: 'content_violation',
        violationDescription: 'Short'
      };

      const result = createCaseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative GMV', () => {
      const invalidData = {
        accountUsername: 'tiktok_user',
        violationType: 'content_violation',
        violationDescription: 'This is a detailed description',
        totalGMV: -100
      };

      const result = createCaseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createMessageSchema', () => {
    it('should validate valid message data', () => {
      const validData = {
        caseId: 1,
        content: 'This is a message',
        attachments: []
      };

      const result = createMessageSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const invalidData = {
        caseId: 1,
        content: '',
        attachments: []
      };

      const result = createMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid case ID', () => {
      const invalidData = {
        caseId: -1,
        content: 'Message',
        attachments: []
      };

      const result = createMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createEvidenceSchema', () => {
    it('should validate valid evidence data', () => {
      const validData = {
        caseId: 1,
        cloudinaryPublicId: 'public_id_123',
        fileUrl: 'https://example.com/file.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        fileType: 'image',
        fileName: 'evidence.jpg',
        description: 'Evidence description'
      };

      const result = createEvidenceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept evidence without file type', () => {
      const validData = {
        caseId: 1,
        cloudinaryPublicId: 'public_id_123',
        fileUrl: 'https://example.com/file.jpg',
        fileName: 'evidence.jpg'
      };

      const result = createEvidenceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('createTemplateSchema', () => {
    it('should validate valid template data', () => {
      const validData = {
        violationType: 'content_violation',
        templateName: 'Template Name',
        templateBody: 'This is the template body with {{variable}}',
        variables: ['variable'],
        winRate: 75
      };

      const result = createTemplateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid win rate', () => {
      const invalidData = {
        violationType: 'content_violation',
        templateName: 'Template Name',
        templateBody: 'Body',
        variables: [],
        winRate: 150
      };

      const result = createTemplateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createPolicySchema', () => {
    it('should validate valid policy data', () => {
      const validData = {
        title: 'Policy Title',
        summary: 'Policy summary text here',
        fullContent: 'Full policy content here with details',
        sourceUrl: 'https://example.com/policy',
        tiktokCategory: 'Community Guidelines',
        severity: 'critical',
        affectsNiches: ['beauty', 'fitness']
      };

      const result = createPolicySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept policy with minimal data', () => {
      const validData = {
        title: 'Policy Title',
        summary: 'Policy summary text'
      };

      const result = createPolicySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('broadcastSchema', () => {
    it('should validate valid broadcast data', () => {
      const validData = {
        targetSegment: 'active',
        subject: 'Broadcast Subject',
        content: 'Broadcast content here'
      };

      const result = broadcastSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid target segment', () => {
      const invalidData = {
        targetSegment: 'invalid_segment',
        subject: 'Subject',
        content: 'Content'
      };

      const result = broadcastSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createSubscriptionSchema', () => {
    it('should validate valid subscription data', () => {
      const validData = {
        plan: 'proshield',
        autoRenew: true
      };

      const result = createSubscriptionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept subscription with just plan', () => {
      const validData = {
        plan: 'basic'
      };

      const result = createSubscriptionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('analyticsQuerySchema', () => {
    it('should validate valid analytics query', () => {
      const validData = {
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
        metric: 'cases_won',
        groupBy: 'day'
      };

      const result = analyticsQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept empty analytics query', () => {
      const validData = {};

      const result = analyticsQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('getOrCreateTokenSchema', () => {
    it('should validate valid token request', () => {
      const validData = {
        discord_id: '12345678901234567',
        discord_username: 'username',
        discord_avatar: 'https://example.com/avatar.jpg'
      };

      const result = getOrCreateTokenSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid discord_id format', () => {
      const invalidData = {
        discord_id: '123',
        discord_username: 'username',
        discord_avatar: 'https://example.com/avatar.jpg'
      };

      const result = getOrCreateTokenSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('revokeAccessSchema', () => {
    it('should validate valid revoke request', () => {
      const validData = {
        discord_id: '12345678901234567'
      };

      const result = revokeAccessSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid discord_id format', () => {
      const invalidData = {
        discord_id: 'not_a_number'
      };

      const result = revokeAccessSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('checkAccessSchema', () => {
    it('should validate valid access check', () => {
      const validData = {
        discord_id: '12345678901234567'
      };

      const result = checkAccessSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject short discord_id', () => {
      const invalidData = {
        discord_id: '123'
      };

      const result = checkAccessSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
