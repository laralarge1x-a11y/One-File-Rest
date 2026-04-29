export const PLAN_CONFIG = {
  basic: {
    id: 'basic',
    displayName: 'Basic Guard Plan',
    emoji: '🔵',
    price: '$79/month',
    billingCycle: 'monthly',
    color: 0x4a90d9,
    hexColor: '#4A90D9',
    maxViolations: 1,
    responseTime: '48–72 hours',
    features: [
      '1 violation per month',
      '48–72 hour response time',
      'Custom appeal writing',
      '1-on-1 support (standard)',
      'Basic violation analysis',
      'Appeal status tracking',
      'Optional express upgrade',
    ],
  },
  fortnightly: {
    id: 'fortnightly',
    displayName: 'Fortnightly Defense Plan',
    emoji: '🟣',
    price: '$159 / 2 weeks',
    billingCycle: 'fortnightly',
    color: 0x9b59b6,
    hexColor: '#9B59B6',
    maxViolations: 3,
    responseTime: 'Under 12 hours',
    features: [
      'Up to 3 violations per 2 weeks',
      'Priority response (<12 hours)',
      'Full-service appeal handling',
      'Direct expert chat',
      'Advanced violation analysis + prevention tips',
      'Escalation support',
      'Faster follow-ups with platform',
      'Ticket priority over Basic users',
    ],
  },
  proshield: {
    id: 'proshield',
    displayName: 'ProShield Creator Plan',
    emoji: '👑',
    price: '$259/month',
    billingCycle: 'monthly',
    color: 0xf1c40f,
    hexColor: '#F1C40F',
    maxViolations: 5,
    responseTime: 'Top queue priority',
    features: [
      'Up to 5 violations per month',
      'Priority handling (top queue)',
      'End-to-end case management',
      'Direct 1-on-1 expert access (fast replies)',
      'Advanced appeal frameworks + proven templates',
      'Weekly account audits & risk checks',
      'Personalised prevention strategy',
      'Creator growth + compliance guidance',
      'Unlimited support & follow-ups',
      'Highest escalation priority',
    ],
  },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

export function getPlanConfig(planId: string) {
  return PLAN_CONFIG[planId as PlanId];
}
