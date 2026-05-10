import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Search,
  Clock,
  ArrowRight,
  ChevronRight,
  FileText,
  Star,
  Tag,
} from 'lucide-react';
import { Card, Input, Badge, Skeleton, CardSkeleton } from '../../components/ui';
import { useKbArticles, useKbCategories } from '../../hooks/queries/useKnowledgeBase';

const KB_ICON = BookOpen;

interface KbArticle {
  id: number;
  slug: string;
  title: string;
  category: string | null;
  tags: string[];
  excerpt: string;
  body_md?: string;
  view_count: number;
  read_time?: number;
  updated_at: string;
}

interface KbCategory {
  category: string;
  count: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  },
};

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return raw;
  }
}

function stripMarkdown(html: string): string {
  return html.replace(/[#*`_~>[\]]/g, '').replace(/\n{2,}/g, ' ').trim();
}

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const { data: articles, isLoading: articlesLoading } = useKbArticles();
  const { data: categories, isLoading: categoriesLoading } = useKbCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const typedArticles = (articles as KbArticle[]) || [];
  const typedCategories = (categories as KbCategory[]) || [];

  // Derive category list with counts from articles if categories endpoint yields different shape
  const categoryPills = useMemo(() => {
    if (typedCategories.length > 0) {
      return typedCategories;
    }
    // Fallback: compute from articles
    const map = new Map<string, number>();
    for (const a of typedArticles) {
      const cat = a.category || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  }, [typedCategories, typedArticles]);

  // Client-side search + category filter
  const filtered = useMemo(() => {
    let result = typedArticles;

    if (activeCategory) {
      result = result.filter((a) => a.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          stripMarkdown(a.excerpt || '').toLowerCase().includes(q) ||
          a.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [typedArticles, activeCategory, searchQuery]);

  // Popular articles (top 4 by view_count)
  const popular = useMemo(() => {
    return [...typedArticles]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 4);
  }, [typedArticles]);

  const isLoading = articlesLoading;

  return (
    <div className="page-wrap">
      {/* ============= HEADER ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(88,101,242,0.12)', color: 'var(--accent)' }}
          >
            <KB_ICON size={20} />
          </div>
          <div>
            <h1 className="text-[26px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>
              Knowledge Base
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Guides, policies, and playbooks
            </p>
          </div>
        </div>
        {!isLoading && typedArticles.length > 0 && (
          <p className="text-xs text-[var(--text-muted)] ml-[52px] -mt-1">
            {typedArticles.length} article{typedArticles.length !== 1 ? 's' : ''}
          </p>
        )}
      </motion.div>

      {/* ============= SEARCH BAR ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mb-4 relative"
      >
        <Input
          ref={searchRef}
          icon={<Search size={16} />}
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {/* Keyboard shortcut hint */}
        {!searchQuery && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1"
            style={{ zIndex: 1 }}
          >
            <kbd
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              ⌘K
            </kbd>
          </div>
        )}
      </motion.div>

      {/* ============= CATEGORY PILLS ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-5"
      >
        <div
          ref={categoryScrollRef}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* All pill */}
          <button
            onClick={() => setActiveCategory(null)}
            className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 flex-shrink-0"
            style={{
              background: activeCategory === null ? 'var(--accent)' : 'var(--bg-glass)',
              color: activeCategory === null ? '#fff' : 'var(--text-secondary)',
              borderColor: activeCategory === null ? 'var(--accent)' : 'var(--border)',
            }}
          >
            All
            <span
              className="ml-1.5 text-[10px] opacity-70"
            >
              ({typedArticles.length})
            </span>
          </button>

          {categoriesLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 w-20 rounded-full flex-shrink-0 skeleton"
                />
              ))
            : categoryPills.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category)}
                  className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 flex-shrink-0"
                  style={{
                    background:
                      activeCategory === cat.category ? 'var(--accent)' : 'var(--bg-glass)',
                    color:
                      activeCategory === cat.category ? '#fff' : 'var(--text-secondary)',
                    borderColor:
                      activeCategory === cat.category ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {cat.category}
                  <span className="ml-1.5 text-[10px] opacity-70">({cat.count})</span>
                </button>
              ))}
        </div>
      </motion.div>

      {/* ============= CONTENT AREA ============= */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* ---- Article Grid ---- */}
        <div>
          {isLoading ? (
            <CardSkeleton count={6} />
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card noHover className="!p-10">
                <div className="flex flex-col items-center text-center py-8">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}
                  >
                    <BookOpen size={28} />
                  </div>
                  <h3 className="text-base font-bold m-0">
                    {searchQuery.trim()
                      ? 'No matching articles'
                      : 'No articles found'}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-xs">
                    {searchQuery.trim()
                      ? 'Try adjusting your search terms or browse a different category.'
                      : 'There are no articles available yet. Check back later.'}
                  </p>
                  {searchQuery.trim() && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveCategory(null);
                      }}
                      className="mt-4 text-xs font-semibold"
                      style={{ color: 'var(--accent)' }}
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
            >
              {filtered.map((article) => (
                <motion.div key={article.id} variants={itemVariants}>
                  <Card
                    onClick={() => navigate(`/kb/${article.slug}`)}
                    className="h-full flex flex-col !p-5"
                  >
                    {/* Category badge */}
                    {article.category && (
                      <div className="mb-2.5">
                        <Badge variant="info" size="sm">
                          <Tag size={10} />
                          {article.category}
                        </Badge>
                      </div>
                    )}

                    {/* Title */}
                    <h3
                      className="text-sm font-bold leading-snug m-0"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {article.title}
                    </h3>

                    {/* Excerpt - 2 line clamp */}
                    <p
                      className="text-xs mt-1.5 leading-relaxed flex-1"
                      style={{
                        color: 'var(--text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {stripMarkdown(article.excerpt || '').slice(0, 200)}
                    </p>

                    {/* Meta row */}
                    <div
                      className="mt-3 pt-3 flex items-center gap-3 text-[11px]"
                      style={{
                        borderTop: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {article.read_time ? (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {article.read_time} min read
                        </span>
                      ) : null}
                      <span>{formatDate(article.updated_at)}</span>
                      <ChevronRight
                        size={14}
                        className="ml-auto"
                        style={{ color: 'var(--accent)' }}
                      />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ---- Popular Articles Sidebar ---- */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton height={16} width="60%" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-glass)]"
                >
                  <Skeleton height={14} width="80%" />
                  <Skeleton height={12} width="40%" className="mt-2" />
                </div>
              ))}
            </div>
          ) : popular.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} style={{ color: 'var(--warning)' }} />
                <h2 className="text-xs font-bold uppercase tracking-wider m-0" style={{ color: 'var(--text-muted)' }}>
                  Popular
                </h2>
              </div>
              <div className="space-y-2">
                {popular.map((article) => (
                  <Card
                    key={article.id}
                    onClick={() => navigate(`/kb/${article.slug}`)}
                    className="!p-3.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(88,101,242,0.1)', color: 'var(--accent)' }}
                      >
                        <FileText size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-xs font-semibold leading-snug m-0"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {article.title}
                        </h4>
                        <div
                          className="flex items-center gap-2 mt-1 text-[10px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <span>{article.view_count || 0} views</span>
                          <span>·</span>
                          <span>{formatDate(article.updated_at)}</span>
                        </div>
                      </div>
                      <ArrowRight
                        size={13}
                        className="flex-shrink-0 mt-1"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}