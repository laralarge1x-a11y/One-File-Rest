import { Pool } from 'pg';

export class CompliancePredictionService {
  constructor(private pool: Pool) {}

  // Calculate compliance score prediction using linear regression
  async predictComplianceScore(caseId: number) {
    // Get case details
    const caseResult = await this.pool.query(
      `SELECT * FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new Error('Case not found');
    }

    const caseData = caseResult.rows[0];

    // Get historical scores for this case
    const historyResult = await this.pool.query(
      `SELECT score, calculated_at FROM compliance_score_history
       WHERE case_id = $1
       ORDER BY calculated_at ASC`,
      [caseId]
    );

    const history = historyResult.rows;

    // Get current compliance score
    const currentScoreResult = await this.pool.query(
      `SELECT score, grade, factors FROM compliance_scores WHERE case_id = $1`,
      [caseId]
    );

    const currentScore = currentScoreResult.rows[0];

    // Calculate trend
    let trend = 'stable';
    if (history.length >= 2) {
      const recentScores = history.slice(-5);
      const avgRecent = recentScores.reduce((sum: number, row: any) => sum + row.score, 0) / recentScores.length;
      const avgOlder = history.slice(0, Math.max(1, history.length - 5))
        .reduce((sum: number, row: any) => sum + row.score, 0) / Math.max(1, history.length - 5);

      if (avgRecent > avgOlder + 5) trend = 'improving';
      else if (avgRecent < avgOlder - 5) trend = 'declining';
    }

    // Simple linear regression prediction
    let predictedScore = currentScore?.score || 50;
    let confidence = 60;

    if (history.length >= 3) {
      const x = history.map((_, i) => i);
      const y = history.map((row: any) => row.score);

      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Predict next 30 days (assuming weekly data points)
      const nextPoint = history.length + 4;
      predictedScore = Math.max(0, Math.min(100, intercept + slope * nextPoint));
      confidence = Math.min(95, 60 + history.length * 5);
    }

    // Generate recommendations based on factors
    const factors = currentScore?.factors || [];
    const recommendations = this.generateRecommendations(factors, predictedScore);

    // Determine predicted grade
    const predictedGrade = this.scoreToGrade(predictedScore);

    // Save prediction
    const predictionResult = await this.pool.query(
      `INSERT INTO compliance_predictions
       (case_id, predicted_score, predicted_grade, confidence_level, prediction_date, factors_influencing, recommendations, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        caseId,
        Math.round(predictedScore),
        predictedGrade,
        confidence,
        new Date(),
        JSON.stringify(factors),
        JSON.stringify(recommendations),
        'v1.0',
      ]
    );

    return {
      caseId,
      currentScore: currentScore?.score || 0,
      currentGrade: currentScore?.grade || 'N/A',
      predictedScore: Math.round(predictedScore),
      predictedGrade,
      confidence,
      trend,
      recommendations,
      factors,
    };
  }

  // Get compliance score history
  async getComplianceHistory(caseId: number, limit: number = 30) {
    const result = await this.pool.query(
      `SELECT score, grade, factors, calculated_at
       FROM compliance_score_history
       WHERE case_id = $1
       ORDER BY calculated_at DESC
       LIMIT $2`,
      [caseId, limit]
    );

    return result.rows.reverse();
  }

  // Get compliance benchmarks
  async getComplianceBenchmarks(violationType?: string) {
    let query = 'SELECT * FROM compliance_benchmarks';
    const params: any[] = [];

    if (violationType) {
      query += ' WHERE violation_type = $1';
      params.push(violationType);
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Compare user score with benchmarks
  async compareWithBenchmarks(caseId: number) {
    const caseResult = await this.pool.query(
      `SELECT violation_type FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new Error('Case not found');
    }

    const violationType = caseResult.rows[0].violation_type;

    const scoreResult = await this.pool.query(
      `SELECT score FROM compliance_scores WHERE case_id = $1`,
      [caseId]
    );

    const userScore = scoreResult.rows[0]?.score || 0;

    const benchmarkResult = await this.pool.query(
      `SELECT * FROM compliance_benchmarks WHERE violation_type = $1`,
      [violationType]
    );

    const benchmark = benchmarkResult.rows[0];

    if (!benchmark) {
      return {
        userScore,
        violationType,
        benchmark: null,
        percentile: null,
      };
    }

    // Calculate percentile
    let percentile = 50;
    if (userScore <= benchmark.percentile_25) percentile = 25;
    else if (userScore <= benchmark.percentile_50) percentile = 50;
    else if (userScore <= benchmark.percentile_75) percentile = 75;
    else if (userScore <= benchmark.percentile_90) percentile = 90;
    else percentile = 95;

    return {
      userScore,
      violationType,
      benchmark: {
        avgScore: benchmark.avg_score,
        medianScore: benchmark.median_score,
        percentile25: benchmark.percentile_25,
        percentile50: benchmark.percentile_50,
        percentile75: benchmark.percentile_75,
        percentile90: benchmark.percentile_90,
        sampleSize: benchmark.sample_size,
      },
      percentile,
      comparison: {
        vsAverage: userScore - benchmark.avg_score,
        vsMedian: userScore - benchmark.median_score,
      },
    };
  }

  // Get trend analysis
  async getTrendAnalysis(caseId: number) {
    const historyResult = await this.pool.query(
      `SELECT score, grade, calculated_at
       FROM compliance_score_history
       WHERE case_id = $1
       ORDER BY calculated_at ASC`,
      [caseId]
    );

    const history = historyResult.rows;

    if (history.length < 2) {
      return {
        trend: 'insufficient_data',
        message: 'Need at least 2 data points for trend analysis',
      };
    }

    const scores = history.map((h: any) => h.score);
    const dates = history.map((h: any) => h.calculated_at);

    // Calculate trend direction
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trendDirection = 'stable';
    if (avgSecond > avgFirst + 5) trendDirection = 'improving';
    else if (avgSecond < avgFirst - 5) trendDirection = 'declining';

    // Calculate volatility
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const volatility = Math.sqrt(variance);

    // Calculate momentum
    const recentScores = scores.slice(-3);
    const momentum = recentScores[recentScores.length - 1] - recentScores[0];

    return {
      trend: trendDirection,
      volatility: volatility.toFixed(2),
      momentum,
      currentScore: scores[scores.length - 1],
      previousScore: scores[scores.length - 2],
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      averageScore: (mean).toFixed(2),
      dataPoints: history.length,
      timeSpan: {
        from: dates[0],
        to: dates[dates.length - 1],
      },
    };
  }

  // Generate insights
  async generateInsights(caseId: number) {
    const caseResult = await this.pool.query(
      `SELECT * FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new Error('Case not found');
    }

    const caseData = caseResult.rows[0];
    const scoreResult = await this.pool.query(
      `SELECT score, factors FROM compliance_scores WHERE case_id = $1`,
      [caseId]
    );

    const score = scoreResult.rows[0];
    const insights: any[] = [];

    if (score) {
      const factors = score.factors || [];

      // Analyze factors
      if (factors.length > 0) {
        const lowFactors = factors.filter((f: any) => f.impact < 30);
        if (lowFactors.length > 0) {
          insights.push({
            type: 'low_impact_factors',
            title: 'Low Impact Factors Detected',
            description: `${lowFactors.length} factors are negatively impacting your score`,
            priority: 'high',
            recommendations: lowFactors.map((f: any) => `Improve: ${f.name}`),
          });
        }
      }

      // Score level insights
      if (score.score < 50) {
        insights.push({
          type: 'low_score',
          title: 'Low Compliance Score',
          description: 'Your compliance score is below average',
          priority: 'critical',
          recommendations: ['Review all factors', 'Consider appeal strategy revision', 'Seek expert guidance'],
        });
      } else if (score.score >= 80) {
        insights.push({
          type: 'high_score',
          title: 'Strong Compliance Score',
          description: 'Your compliance score is above average',
          priority: 'low',
          recommendations: ['Maintain current practices', 'Document successful strategies'],
        });
      }
    }

    // Case status insights
    if (caseData.status === 'pending') {
      insights.push({
        type: 'pending_case',
        title: 'Case Pending',
        description: 'Your case is still pending',
        priority: 'medium',
        recommendations: ['Follow up on case status', 'Prepare additional evidence if needed'],
      });
    }

    return insights;
  }

  // Helper: Convert score to grade
  private scoreToGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Helper: Generate recommendations
  private generateRecommendations(factors: any[], predictedScore: number): string[] {
    const recommendations: string[] = [];

    if (predictedScore < 60) {
      recommendations.push('Urgent: Score is declining. Review appeal strategy immediately.');
      recommendations.push('Consider seeking professional assistance.');
    }

    if (predictedScore < 70) {
      recommendations.push('Focus on improving key factors affecting your score.');
      recommendations.push('Gather additional supporting evidence.');
    }

    if (predictedScore >= 80) {
      recommendations.push('Maintain current practices - they are working well.');
      recommendations.push('Document and share successful strategies.');
    }

    // Factor-specific recommendations
    factors.forEach((factor: any) => {
      if (factor.impact < 30) {
        recommendations.push(`Address "${factor.name}" to improve score.`);
      }
    });

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  // Update benchmarks (admin function)
  async updateBenchmarks(violationType: string, benchmarkData: any) {
    const result = await this.pool.query(
      `INSERT INTO compliance_benchmarks
       (violation_type, avg_score, median_score, percentile_25, percentile_50, percentile_75, percentile_90, sample_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (violation_type) DO UPDATE SET
       avg_score = $2, median_score = $3, percentile_25 = $4, percentile_50 = $5,
       percentile_75 = $6, percentile_90 = $7, sample_size = $8, updated_at = NOW()
       RETURNING *`,
      [
        violationType,
        benchmarkData.avgScore,
        benchmarkData.medianScore,
        benchmarkData.percentile25,
        benchmarkData.percentile50,
        benchmarkData.percentile75,
        benchmarkData.percentile90,
        benchmarkData.sampleSize,
      ]
    );

    return result.rows[0];
  }
}
