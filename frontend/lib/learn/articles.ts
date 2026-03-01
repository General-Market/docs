import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface ArticleFrontmatter {
  title: string;
  description: string;
  keywords: string[];
  date: string;
  author: string;
  slug: string;
  category: string;
  readingTime: string;
  tldr?: string[];
}

export interface ArticleHeading {
  text: string;
  id: string;
}

export interface Article {
  frontmatter: ArticleFrontmatter;
  content: string;
  headings: ArticleHeading[];
}

const CONTENT_DIR = path.join(process.cwd(), "content", "learn");

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function extractHeadings(content: string): ArticleHeading[] {
  const matches = content.matchAll(/^## (.+)$/gm);
  return Array.from(matches, (m) => ({
    text: m[1],
    id: slugify(m[1]),
  }));
}

export function getArticleSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getArticle(slug: string): Article | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    frontmatter: data as ArticleFrontmatter,
    content,
    headings: extractHeadings(content),
  };
}

export function getAllArticles(): Article[] {
  return getArticleSlugs()
    .map(getArticle)
    .filter((a): a is Article => a !== null)
    .sort(
      (a, b) =>
        new Date(b.frontmatter.date).getTime() -
        new Date(a.frontmatter.date).getTime()
    );
}
