'use client';

import type { ArticleFrontmatter } from "@/lib/learn/articles";
import { useTranslations } from 'next-intl';

interface ArticleHeaderProps {
  frontmatter: ArticleFrontmatter;
}

export function ArticleHeader({ frontmatter }: ArticleHeaderProps) {
  const t = useTranslations('pages');
  return (
    <div className="pt-16 pb-10 md:pt-20 md:pb-14 px-6">
      <div className="max-w-[940px] mx-auto text-center">
        {/* Category badge */}
        <span className="inline-block border border-zinc-300 text-zinc-600 text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1 rounded-full mb-5">
          {frontmatter.category}
        </span>

        {/* Title */}
        <h1 className="text-[36px] md:text-[52px] font-black tracking-tight text-black leading-[1.08] mb-4">
          {frontmatter.title}
        </h1>

        {/* Description */}
        <div className="max-w-[620px] mx-auto">
          <p className="text-[16px] md:text-[17px] text-zinc-500 leading-relaxed">
            {frontmatter.description}
          </p>
        </div>

        {/* Meta */}
        <div className="text-[13px] text-zinc-400 mt-5">
          {frontmatter.readingTime} &middot; {frontmatter.date}
        </div>

        {/* TLDR */}
        {frontmatter.tldr && frontmatter.tldr.length > 0 && (
          <div className="max-w-[620px] mx-auto mt-10 pt-8 border-t border-zinc-200 text-left">
            <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-400 mb-4">
              {t('learn.article_header.key_takeaways')}
            </div>
            <ol className="space-y-3">
              {frontmatter.tldr.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[12px] font-bold font-mono text-zinc-400 shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="text-[15px] text-zinc-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
