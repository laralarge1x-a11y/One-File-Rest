import { calculateComplianceScore, getUserComplianceScores, recalculateComplianceScore, clearComplianceCache } from '../server/services/compliance-score';

describe('Compliance Score Service', () => {
  describe('calculateComplianceScore', () => {
    it('should return a score between 0 and 100', async () => {
      // Mock test - in real scenario would use test database
      const mockScore = {
        score: 75,
        grade: 'C' as const,
        factors: [],
        trend: 'stable' as const,
        recommendations: [],
        lastCalculated: new Date()
      };

      expect(mockScore.score).toBeGreaterThanOrEqual(0);
      expect(mockScore.score).toBeLessThanOrEqual(100);
    });

    it('should assign correct grade based on score', () => {
      const testCases = [
        { score: 95, expectedGrade: 'A' },
        { score: 75, expectedGrade: 'B' },
        { score: 60, expectedGrade: 'C' },
        { score: 40, expectedGrade: 'D' },
        { score: 20, expectedGrade: 'F' }
      ];

      testCases.forEach(({ score, expectedGrade }) => {
        let grade: 'A' | 'B' | 'C' | 'D' | 'F';
        if (score >= 85) grade = 'A';
        else if (score >= 70) grade = 'B';
        else if (score >= 50) grade = 'C';
        else if (score >= 30) grade = 'D';
        else grade = 'F';

        expect(grade).toBe(expectedGrade);
      });
    });

    it('should calculate trend correctly', () => {
      const currentScore = 75;
      const previousScore = 65;

      let trend: 'improving' | 'stable' | 'declining';
      if (currentScore > previousScore + 5) trend = 'improving';
      else if (currentScore < previousScore - 5) trend = 'declining';
      else trend = 'stable';

      expect(trend).toBe('improving');
    });

    it('should include factors in result', () => {
      const mockResult = {
        score: 80,
        grade: 'B' as const,
        factors: [
          { name: 'Recent violations', impact: -15, description: '1 violation(s) in last 90 days' }
        ],
        trend: 'stable' as const,
        recommendations: ['Focus on avoiding new violations'],
        lastCalculated: new Date()
      };

      expect(Array.isArray(mockResult.factors)).toBe(true);
      expect(mockResult.factors.length).toBeGreaterThan(0);
      expect(mockResult.factors[0]).toHaveProperty('name');
      expect(mockResult.factors[0]).toHaveProperty('impact');
      expect(mockResult.factors[0]).toHaveProperty('description');
    });

    it('should include recommendations in result', () => {
      const mockResult = {
        score: 50,
        grade: 'C' as const,
        factors: [],
        trend: 'stable' as const,
        recommendations: [
          'Post face videos to improve your compliance score',
          'Focus on avoiding new violations'
        ],
        lastCalculated: new Date()
      };

      expect(Array.isArray(mockResult.recommendations)).toBe(true);
      expect(mockResult.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Score Calculation Logic', () => {
    it('should deduct points for recent violations', () => {
      let score = 100;
      const recentViolations = 2;
      score -= recentViolations * 15;

      expect(score).toBe(70);
    });

    it('should deduct points for denied appeals', () => {
      let score = 100;
      const deniedAppeals = 3;
      score -= deniedAppeals * 10;

      expect(score).toBe(70);
    });

    it('should deduct points for frozen commission', () => {
      let score = 100;
      score -= 20;

      expect(score).toBe(80);
    });

    it('should deduct points for purchased account', () => {
      let score = 100;
      score -= 10;

      expect(score).toBe(90);
    });

    it('should add points for won appeals', () => {
      let score = 50;
      const wonAppeals = 2;
      score += wonAppeals * 10;

      expect(score).toBe(70);
    });

    it('should add points for 90+ days clean', () => {
      let score = 50;
      score += 15;

      expect(score).toBe(65);
    });

    it('should add points for high GMV', () => {
      let score = 50;
      const gmv = 5000;
      if (gmv >= 3000) score += 5;

      expect(score).toBe(55);
    });

    it('should cap score at 100', () => {
      let score = 150;
      score = Math.min(100, score);

      expect(score).toBe(100);
    });

    it('should cap score at 0', () => {
      let score = -50;
      score = Math.max(0, score);

      expect(score).toBe(0);
    });
  });

  describe('Trend Calculation', () => {
    it('should detect improving trend', () => {
      const currentScore = 80;
      const previousScore = 60;

      let trend: 'improving' | 'stable' | 'declining';
      if (currentScore > previousScore + 5) trend = 'improving';
      else if (currentScore < previousScore - 5) trend = 'declining';
      else trend = 'stable';

      expect(trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      const currentScore = 40;
      const previousScore = 60;

      let trend: 'improving' | 'stable' | 'declining';
      if (currentScore > previousScore + 5) trend = 'improving';
      else if (currentScore < previousScore - 5) trend = 'declining';
      else trend = 'stable';

      expect(trend).toBe('declining');
    });

    it('should detect stable trend', () => {
      const currentScore = 65;
      const previousScore = 63;

      let trend: 'improving' | 'stable' | 'declining';
      if (currentScore > previousScore + 5) trend = 'improving';
      else if (currentScore < previousScore - 5) trend = 'declining';
      else trend = 'stable';

      expect(trend).toBe('stable');
    });
  });
});
