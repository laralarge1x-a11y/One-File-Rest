import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useStaff } from '../../hooks/queries/useStaff';
import { Card, Badge, Button, Input, Skeleton, CardSkeleton } from '../../components/ui';
import {
  Users,
  Search,
  Star,
  Clock,
  CheckCircle,
  Award,
  Globe,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface StaffMember {
  id: number | string;
  discord_username: string;
  avatar_url?: string;
  role: string;
  bio?: string;
  specialties?: string[];
  is_available?: boolean;
  response_time?: string;
  completed_cases?: number;
  rating?: number;
  languages?: string[];
  online?: boolean;
}

interface Review {
  author: string;
  text: string;
  rating: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const MOCK_REVIEWS: Record<string, Review[]> = {
  default: [
    { author: 'Alex M.', text: 'Incredibly fast and thorough — got my account back in under 24 hours.', rating: 5 },
    { author: 'Jordan T.', text: 'Very professional and kept me updated throughout the whole process.', rating: 5 },
    { author: 'Sam K.', text: 'Knew exactly what to do with TikTok support. Highly recommend.', rating: 4 },
  ],
};

function avatarUrl(member: StaffMember): string {
  return member.avatar_url || `https://cdn.discordapp.com/embed/avatars/${Number(member.id) % 5}.png`;
}

function extractSpecialties(members: StaffMember[]): string[] {
  const set = new Set<string>();
  for (const m of members) {
    if (m.specialties) {
      for (const s of m.specialties) set.add(s);
    }
  }
  const order = ['Account Recovery', 'Ban Appeals', 'Policy', 'Technical', 'Verification', 'Payment Issues'];
  return order.filter((o) => set.has(o)).concat([...set].filter((s) => !order.includes(s)));
}

function ratingStars(rating: number): string {
  const full = Math.floor(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function Specialists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: staff, isLoading } = useStaff();
  const members = (staff as StaffMember[] | undefined) ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

  const specialties = useMemo(() => extractSpecialties(members), [members]);

  const filtered = useMemo(() => {
    let result = members;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.discord_username.toLowerCase().includes(q) ||
          (m.specialties && m.specialties.some((s) => s.toLowerCase().includes(q))),
      );
    }
    if (activeFilter) {
      result = result.filter((m) => m.specialties && m.specialties.includes(activeFilter));
    }
    return result;
  }, [members, searchQuery, activeFilter]);

  const plan = user?.plan || 'free';
  const isFreePlan = plan === 'free';

  const toggleExpand = (id: number | string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="mb-8">
          <Skeleton height={32} width={200} />
          <Skeleton height={16} width={280} className="mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <CardSkeleton count={6} />
        </div>
      </div>
    );
  }

  /* ---- Empty state ---- */
  if (members.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ backgroundColor: 'var(--bg-glass)' }}
          >
            <Users size={32} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            No specialists available
          </h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
            There are no specialists currently assigned to this portal. Please check back later or
            contact support for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* ---- Header ---- */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Specialists
          </h1>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--bg-glass)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {members.length} {members.length === 1 ? 'person' : 'people'}
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Meet our expert team — TikTok account recovery specialists ready to help you regain access.
        </p>
      </motion.div>

      {/* ---- Filter Bar ---- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-6 space-y-4"
      >
        {/* Search */}
        <div className="max-w-sm">
          <Input
            placeholder="Search by name or specialty..."
            icon={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter pills */}
        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150"
              style={{
                backgroundColor: activeFilter === null ? 'var(--accent)' : 'var(--bg-glass)',
                color: activeFilter === null ? '#fff' : 'var(--text-secondary)',
                borderColor: activeFilter === null ? 'var(--accent)' : 'var(--border)',
              }}
            >
              All
            </button>
            {specialties.map((spec) => (
              <button
                key={spec}
                onClick={() => setActiveFilter((prev) => (prev === spec ? null : spec))}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150"
                style={{
                  backgroundColor: activeFilter === spec ? 'var(--accent)' : 'var(--bg-glass)',
                  color: activeFilter === spec ? '#fff' : 'var(--text-secondary)',
                  borderColor: activeFilter === spec ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {spec}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* ---- Specialist Grid ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((member) => {
            const isExpanded = expandedId === member.id;
            return (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  onClick={() => toggleExpand(member.id)}
                  className="h-full"
                >
                  {/* Card content */}
                  {!isExpanded ? (
                    <CompactCard member={member} plan={plan} isFreePlan={isFreePlan} />
                  ) : (
                    <ExpandedCard
                      member={member}
                      reviews={MOCK_REVIEWS[member.discord_username] || MOCK_REVIEWS.default}
                      plan={plan}
                      isFreePlan={isFreePlan}
                      onAssign={() => navigate('/cases/new')}
                    />
                  )}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ---- No results ---- */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--bg-glass)' }}
          >
            <Search size={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            No specialists match your search
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Try a different name or specialty keyword.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function CompactCard({
  member,
  plan,
  isFreePlan,
}: {
  member: StaffMember;
  plan: string;
  isFreePlan: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Top: avatar + name + status */}
      <div className="flex items-start gap-4 p-5 pb-3">
        <div className="relative shrink-0">
          <img
            src={avatarUrl(member)}
            alt={member.discord_username}
            className="w-14 h-14 rounded-full object-cover"
            style={{ border: '2px solid var(--border)' }}
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
            style={{
              backgroundColor: member.is_available ? 'var(--success)' : 'var(--text-muted)',
              borderColor: 'var(--bg-primary)',
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-bold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {member.discord_username}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {member.role}
          </p>

          {/* Availability */}
          {member.is_available ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1"
              style={{ color: 'var(--success)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              Available Now
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
              Unavailable
            </span>
          )}
        </div>
      </div>

      {/* Bio excerpt */}
      {member.bio && (
        <div className="px-5 pb-2">
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {member.bio}
          </p>
        </div>
      )}

      {/* Specialty badges */}
      {member.specialties && member.specialties.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {member.specialties.slice(0, 3).map((spec) => (
            <Badge key={spec} variant="info" size="sm">
              {spec}
            </Badge>
          ))}
          {member.specialties.length > 3 && (
            <Badge variant="default" size="sm">
              +{member.specialties.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="px-5 pb-3 flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {member.completed_cases !== undefined && (
          <span className="flex items-center gap-1">
            <CheckCircle size={12} />
            {member.completed_cases.toLocaleString()} cases
          </span>
        )}
        {member.response_time && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {member.response_time}
          </span>
        )}
        {member.rating !== undefined && (
          <span className="flex items-center gap-1" style={{ color: 'var(--warning)' }}>
            <Star size={12} />
            {member.rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Footer: action */}
      <div
        className="mt-auto px-5 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {isFreePlan ? (
          <Badge variant="warning" size="sm">
            <Zap size={12} />
            Upgrade to request specialists
          </Badge>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!member.is_available}
            onClick={(e) => {
              e.stopPropagation();
              /* Request logic handled by parent navigation if needed */
            }}
          >
            Request
          </Button>
        )}
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <ChevronDown size={14} />
        </span>
      </div>
    </div>
  );
}

function ExpandedCard({
  member,
  reviews,
  plan,
  isFreePlan,
  onAssign,
}: {
  member: StaffMember;
  reviews: Review[];
  plan: string;
  isFreePlan: boolean;
  onAssign: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Close hint */}
      <div className="flex items-center justify-end px-5 pt-3 pb-0">
        <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <ChevronUp size={14} />
          Collapse
        </span>
      </div>

      {/* Avatar + Name row */}
      <div className="flex items-center gap-4 px-5 pb-3 pt-1">
        <div className="relative shrink-0">
          <img
            src={avatarUrl(member)}
            alt={member.discord_username}
            className="w-16 h-16 rounded-full object-cover"
            style={{ border: '2px solid var(--border)' }}
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
            style={{
              backgroundColor: member.is_available ? 'var(--success)' : 'var(--text-muted)',
              borderColor: 'var(--bg-primary)',
            }}
          />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {member.discord_username}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {member.role}
          </p>
          {member.is_available ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold mt-1"
              style={{ color: 'var(--success)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              Available Now
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
              Unavailable
            </span>
          )}
        </div>
      </div>

      {/* Full bio */}
      {member.bio && (
        <div className="px-5 pb-3">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {member.bio}
          </p>
        </div>
      )}

      {/* Specialty badges (all) */}
      {member.specialties && member.specialties.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {member.specialties.map((spec) => (
            <Badge key={spec} variant="info" size="sm">
              {spec}
            </Badge>
          ))}
        </div>
      )}

      {/* Stats row with icons */}
      <div
        className="px-5 py-3 grid grid-cols-3 gap-3 text-center"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <StatItem
          icon={<Award size={16} />}
          label="Completed"
          value={member.completed_cases?.toLocaleString() || '0'}
        />
        <StatItem
          icon={<Clock size={16} />}
          label="Response"
          value={member.response_time || '—'}
        />
        <StatItem
          icon={<Star size={16} />}
          label="Rating"
          value={member.rating !== undefined ? member.rating.toFixed(1) : '—'}
        />
      </div>

      {/* Languages */}
      {member.languages && member.languages.length > 0 && (
        <div className="px-5 py-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Globe size={14} />
          <span>
            Speaks:{' '}
            {member.languages.map((lang, i) => (
              <span key={lang}>
                {lang}
                {i < member.languages!.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Reviews / Testimonials */}
      {reviews.length > 0 && (
        <div className="px-5 pb-3">
          <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <MessageSquare size={13} />
            Testimonials
          </h4>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <div
                key={i}
                className="rounded-[var(--radius-md)] p-2.5"
                style={{ backgroundColor: 'var(--bg-glass)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {r.author}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--warning)' }}>
                    {ratingStars(r.rating)}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  &ldquo;{r.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign action */}
      <div
        className="px-5 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {isFreePlan ? (
          <Badge variant="warning" size="md" className="w-full justify-center">
            <Zap size={14} />
            Upgrade to request specialists
          </Badge>
        ) : (
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={!member.is_available}
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
          >
            Assign to my case
          </Button>
        )}
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}