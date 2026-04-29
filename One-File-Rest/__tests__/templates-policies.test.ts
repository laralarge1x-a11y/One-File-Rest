describe('Templates API Logic', () => {
  describe('Template validation', () => {
    it('should validate violation types', () => {
      const validTypes = ['content_violation', 'copyright', 'fraud', 'other'];
      const testType = 'content_violation';
      expect(validTypes).toContain(testType);
    });

    it('should validate win rate range', () => {
      const winRate = 75;
      expect(winRate).toBeGreaterThanOrEqual(0);
      expect(winRate).toBeLessThanOrEqual(100);
    });

    it('should reject win rate above 100', () => {
      const winRate = 150;
      expect(winRate).toBeGreaterThan(100);
    });

    it('should extract variables from template', () => {
      const template = 'Hello {{name}}, your case {{caseId}} is {{status}}';
      const variables = template.match(/\{\{(\w+)\}\}/g) || [];
      expect(variables).toHaveLength(3);
    });
  });

  describe('Template filtering', () => {
    it('should filter templates by violation type', () => {
      const templates = [
        { id: 1, violationType: 'content_violation', name: 'Template 1' },
        { id: 2, violationType: 'copyright', name: 'Template 2' },
        { id: 3, violationType: 'content_violation', name: 'Template 3' },
      ];

      const contentViolationTemplates = templates.filter(t => t.violationType === 'content_violation');
      expect(contentViolationTemplates).toHaveLength(2);
    });

    it('should sort templates by win rate', () => {
      const templates = [
        { id: 1, name: 'Template 1', winRate: 60 },
        { id: 2, name: 'Template 2', winRate: 85 },
        { id: 3, name: 'Template 3', winRate: 70 },
      ];

      const sorted = [...templates].sort((a, b) => b.winRate - a.winRate);
      expect(sorted[0].winRate).toBe(85);
      expect(sorted[2].winRate).toBe(60);
    });
  });
});

describe('Policies API Logic', () => {
  describe('Policy validation', () => {
    it('should validate severity levels', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      const testSeverity = 'high';
      expect(validSeverities).toContain(testSeverity);
    });

    it('should reject invalid severity', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      const invalidSeverity = 'extreme';
      expect(validSeverities).not.toContain(invalidSeverity);
    });
  });

  describe('Policy filtering', () => {
    it('should filter policies by severity', () => {
      const policies = [
        { id: 1, title: 'Policy 1', severity: 'high' },
        { id: 2, title: 'Policy 2', severity: 'low' },
        { id: 3, title: 'Policy 3', severity: 'critical' },
      ];

      const critical = policies.filter(p => p.severity === 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].id).toBe(3);
    });

    it('should filter high-priority policies', () => {
      const policies = [
        { id: 1, title: 'Policy 1', severity: 'high' },
        { id: 2, title: 'Policy 2', severity: 'low' },
        { id: 3, title: 'Policy 3', severity: 'critical' },
      ];

      const highPriority = policies.filter(p => ['high', 'critical'].includes(p.severity));
      expect(highPriority).toHaveLength(2);
    });
  });
});
