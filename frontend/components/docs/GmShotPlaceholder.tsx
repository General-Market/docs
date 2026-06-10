/* A wireframe stand-in for a future screenshot, rendered from a ```gm-shot
   fence. The body of the fence is the caption. Framed like a .docs-figure but
   dashed and empty - a placeholder the author fills with a real shot later.
   docs.css strips the <pre> chrome via pre:has(.docs-shot-placeholder). */

export default function GmShotPlaceholder({ caption }: { caption: string }) {
  return (
    <span className="docs-shot-placeholder">
      <span className="docs-shot-placeholder__label">Screenshot</span>
      <span className="docs-shot-placeholder__caption">{caption}</span>
    </span>
  );
}
