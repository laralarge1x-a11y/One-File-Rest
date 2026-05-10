import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Tag,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Card, Badge, Button, Skeleton } from '../../components/ui';
import { useKbArticle } from '../../hooks/queries/useKnowledgeBase';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface RelatedArticle {
  slug: string;
  title: string;
  category?: string;
}

interface KbArticleData {
  title: string;
  content: string;
  slug: string;
  category?: string;
  category_slug?: string;
  read_time?: number;
  updated_at?: string;
  created_at?: string;
  related_articles?: RelatedArticle[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  Reading progress hook                                             */
/* ------------------------------------------------------------------ */

function useReadingProgress(ref: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) {
        setProgress(100);
        return;
      }
      setProgress(Math.min(100, (scrollTop / maxScroll) * 100));
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [ref]);

  return progress;
}

/* ------------------------------------------------------------------ */
/*  Article HTML renderer styles                                      */
/* ------------------------------------------------------------------ */

const proseStyles =
  'prose-styles [&_h2]:text-[var(--text-primary)] [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-[var(--border)] ' +
  '[&_h3]:text-[var(--text-primary)] [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 ' +
  '[&_h4]:text-[var(--text-primary)] [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 ' +
  '[&_p]:text-[var(--text-secondary)] [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-[15px] ' +
  '[&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[var(--accent)]/30 [&_a]:transition-[var(--transition)] ' +
  '[&_a:hover]:decoration-[var(--accent)] [&_a:hover]:brightness-110 ' +
  '[&_ul]:text-[var(--text-secondary)] [&_ul]:mb-4 [&_ul]:pl-6 [&_ul]:space-y-1.5 ' +
  '[&_ol]:text-[var(--text-secondary)] [&_ol]:mb-4 [&_ol]:pl-6 [&_ol]:space-y-1.5 ' +
  '[&_li]:text-[15px] [&_li]:leading-relaxed ' +
  '[&_li::marker]:text-[var(--accent)] ' +
  '[&_code]:bg-[var(--bg-glass)] [&_code]:text-[var(--text-primary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-[var(--radius-md)] [&_code]:text-[13px] [&_code]:font-mono ' +
  '[&_pre]:bg-[var(--bg-glass)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:rounded-[var(--radius-lg)] [&_pre]:p-4 [&_pre]:mb-4 [&_pre]:overflow-x-auto ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:border-none ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--text-secondary)] [&_blockquote]:mb-4 [&_blockquote]:text-[15px] ' +
  '[&_img]:rounded-[var(--radius-lg)] [&_img]:max-w-full [&_img]:h-auto [&_img]:my-6 [&_img]:border [&_img]:border-[var(--border)] ' +
  '[&_hr]:border-[var(--border)] [&_hr]:my-8 ' +
  '[&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_table]:text-[14px] ' +
  '[&_th]:text-left [&_th]:text-[var(--text-primary)] [&_th]:font-semibold [&_th]:p-3 [&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-[var(--bg-glass)] ' +
  '[&_td]:text-[var(--text-secondary)] [&_td]:p-3 [&_td]:border-b [&_td]:border-[var(--border)]';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function KbArticle() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const articleRef = useRef<HTMLDivElement>(null);
  const progress = useReadingProgress(articleRef);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const { data, isLoading, isError } = useKbArticle(slug);

  const handleBack = useCallback(() => {
    navigate('/kb');
  }, [navigate]);

  const handleFeedback = useCallback((type: 'up' | 'down') => {
    setFeedback((prev) => (prev === type ? null : type));
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: data?.title ?? 'Knowledge Base', url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, [data]);

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Back button placeholder */}
          <div className="mb-6">
            <Skeleton height={36} width={80} borderRadius="var(--radius-md)" />
          </div>
          {/* Title */}
          <Skeleton height={32} width="75%" className="mb-3" />
          {/* Meta row */}
          <div className="flex items-center gap-3 mb-8">
            <Skeleton height={22} width={80} borderRadius="9999px" />
            <Skeleton height={14} width={90} />
            <Skeleton height={14} width={120} />
          </div>
          {/* Content skeleton */}
          <div className="space-y-3">
            <Skeleton height={14} count={1} width="100%" />
            <Skeleton height={14} count={1} width="90%" />
            <Skeleton height={14} count={1} width="95%" />
            <Skeleton height={14} count={1} width="60%" />
            <div className="h-4" />
            <Skeleton height={14} count={1} width="100%" />
            <Skeleton height={14} count={1} width="85%" />
            <Skeleton height={14} count={1} width="70%" />
            <Skeleton height={14} count={1} width="92%" />
            <div className="h-4" />
            <Skeleton height={14} count={1} width="100%" />
            <Skeleton height={14} count={1} width="88%" />
            <Skeleton height={14} count={1} width="75%" />
          </div>
        </div>
      </div>
    );
  }

  /* ---- Error / not found state ---- */
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center px-4"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--bg-glass)] mb-4">
            <AlertCircle className="w-8 h-8 text-[var(--danger)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Article not found
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-6 max-w-xs mx-auto">
            This article may have been moved or deleted. Try browsing the knowledge base.
          </p>
          <Button variant="secondary" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4" />
            Back to Knowledge Base
          </Button>
        </motion.div>
      </div>
    );
  }

  const article = data as KbArticleData;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-[var(--bg-glass)]">
        <motion.div
          className="h-full bg-[var(--accent)] origin-left"
          style={{ scaleX: progress / 100 }}
          layout
        />
      </div>

      <div
        ref={articleRef}
        className="max-w-3xl mx-auto px-4 py-8 overflow-y-auto"
        style={{ height: 'calc(100vh - 2px)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* ---- Back button ---- */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>

          {/* ---- Article header ---- */}
          <header className="mb-8">
            <h1 className="text-[28px] leading-tight font-bold text-[var(--text-primary)] mb-4">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
              {article.category && (
                <Badge variant="info" size="sm">
                  <Tag className="w-3 h-3" />
                  {article.category}
                </Badge>
              )}

              {article.read_time != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {article.read_time} min read
                </span>
              )}

              {article.updated_at && (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Updated {formatDate(article.updated_at)}
                </span>
              )}
            </div>
          </header>

          {/* ---- Article content ---- */}
          <Card className="mb-8 !bg-transparent !border-none !shadow-none">
            <div
              className={proseStyles}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </Card>

          {/* ---- Share / Feedback ---- */}
          <Card className="mb-10 !bg-[var(--bg-glass)]">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              {/* Feedback */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--text-muted)]">
                  Was this helpful?
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFeedback('up')}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-[var(--transition)] ${
                      feedback === 'up'
                        ? 'bg-[rgba(87,242,135,0.15)] text-[var(--success)]'
                        : 'bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-glass-hover)]'
                    }`}
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback('down')}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-[var(--transition)] ${
                      feedback === 'down'
                        ? 'bg-[rgba(237,66,69,0.15)] text-[var(--danger)]'
                        : 'bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-glass-hover)]'
                    }`}
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Share */}
              <Button variant="secondary" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </Card>

          {/* ---- Related articles ---- */}
          {article.related_articles && article.related_articles.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                Related Articles
              </h2>
              <div className="space-y-2">
                {article.related_articles.map((related) => (
                  <button
                    key={related.slug}
                    type="button"
                    onClick={() => navigate(`/kb/${related.slug}`)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-glass)] border border-[var(--border)] text-left transition-[var(--transition)] hover:bg-[var(--bg-glass-hover)] hover:border-[rgba(255,255,255,0.12)] cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-white transition-colors">
                        {related.title}
                      </span>
                      {related.category && (
                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                          {related.category}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--text-secondary)] transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </div>
  );
}