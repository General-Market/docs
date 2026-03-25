import type { ArticleFrontmatter } from "@/lib/learn/articles";

interface ArticleAuthorProps {
  frontmatter: ArticleFrontmatter;
}

export function ArticleAuthor({ frontmatter }: ArticleAuthorProps) {
  return (
    <div className="mt-16 pt-10 border-t border-zinc-200">
      <div className="border border-zinc-200 rounded-2xl p-8 md:p-10 bg-white shadow-[inset_0_-3px_3px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-4">
            <span className="text-white text-[22px] font-black tracking-tight">GM</span>
          </div>

          {/* Name */}
          <h3 className="text-[20px] font-bold text-black">
            {frontmatter.author}
          </h3>

          {/* Role */}
          <p className="text-[14px] text-zinc-500 font-medium mt-0.5">
            On-chain index products & prediction markets
          </p>

          {/* Bio */}
          <p className="text-[14px] text-zinc-400 leading-relaxed mt-4 max-w-md">
            Building infrastructure for tokenized indices and sealed prediction markets. BLS-verified oracle consensus. No KYC. No front-running.
          </p>
        </div>
      </div>
    </div>
  );
}
