import type { ArticleFrontmatter } from "@/lib/learn/articles";

interface ArticleHeaderProps {
  frontmatter: ArticleFrontmatter;
}

export function ArticleHeader({ frontmatter }: ArticleHeaderProps) {
  return (
    <div className="hero-band">
      <div className="hero-band-inner">
        {/* Category badge */}
        <span className="inline-block bg-black text-white text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1 mb-4">
          {frontmatter.category}
        </span>

        {/* Title */}
        <h1 className="text-[28px] md:text-[48px] font-black tracking-[-0.03em] text-black leading-[1.05] mb-3">
          {frontmatter.title}
        </h1>

        {/* Meta */}
        <div className="text-[14px] text-text-muted">
          {frontmatter.readingTime} &middot; {frontmatter.date}
        </div>

        {/* TLDR */}
        {frontmatter.tldr && frontmatter.tldr.length > 0 && (
          <div className="section-divider mt-8 pt-6">
            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-4">
              Key Takeaways
            </div>
            <ol className="space-y-3">
              {frontmatter.tldr.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[13px] font-bold font-mono text-text-muted shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="text-[15px] text-text-secondary leading-relaxed"
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
