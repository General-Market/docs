import type { MDXComponents } from "mdx/types";
import { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { Callout } from "./Callout";
import { ComparisonTable } from "./ComparisonTable";
import { CodeBlock } from "./CodeBlock";
import { FadeInSection } from "@/components/learn/FadeInSection";
import {
  FrameTransactionScene,
  PaymasterFlow,
  MempoolLayers,
  EIPTimeline,
  EIPTimeline3D,
  PrivacyDiagram,
  BeforeAfterScene,
  FrameFlow,
  FlowNormalTx,
  FlowAtomicOps,
  FlowNewAccount,
  FlowPrivacyZK,
  StatsOverview,
  StatsUnlocked,
  EOABenefits,
  CapabilityCards,
  FOCILComparison,
  QuantumComparison,
  HegotaSummary,
} from "@/components/learn/diagrams";
import {
  RoadmapStaircase3D,
  ParallelVerification3D,
  EPBSSlotClock3D,
  GasEvolution3D,
  BlobSampling3D,
  ZKEVMPopulation3D,
  EOFContainerization3D,
  FullStackLayers3D,
  ScalingStats,
  ScalingSummary,
  AccessListConflict3D,
  SlotBudget3D,
  ErasureCoding3D,
  GasReservoir3D,
  ProverConsensus3D,
} from "@/components/learn/diagrams/scaling";
import {
  NormalVsFrame3D,
  FrameOverview3D,
  MultisigAuth3D,
  AccountDeploy3D,
  PaymasterFlow3D as PaymasterFlow3DNew,
  ZKPrivacy3D,
  FOCILGuard3D,
  AtomicBatch3D,
  PromiseScene3D,
  PayoffScene3D,
  HistoryTimeline3D,
  SocialProof3D,
} from "@/components/learn/diagrams/eip8141-v2";
import {
  FoundersStats,
  FoundersAgeTimeline,
  TGEAgePerformance,
  TeamCompPerformanceGrid,
  TeamGenderPerformance,
  TeamNatPerformance,
  TeamAgeSpreadPerformance,
  TeamEduPerformance,
} from "@/components/learn/diagrams/founders";

function extractTextFromReactNode(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join("");
  if (typeof node === "object" && "props" in node) {
    const el = node as { props: { children?: ReactNode } };
    return extractTextFromReactNode(el.props.children);
  }
  return "";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export const mdxComponents: MDXComponents = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-[32px] md:text-[40px] font-black tracking-[-0.02em] text-black leading-[1.1] mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = extractTextFromReactNode(children);
    const id = slugify(text);
    return (
      <FadeInSection>
        <h2
          id={id}
          className="scroll-mt-24 border-t-[3px] border-black pt-8 mt-16 mb-6 text-[24px] md:text-[28px] font-black tracking-[-0.02em] text-black leading-[1.1]"
        >
          {children}
        </h2>
      </FadeInSection>
    );
  },
  h3: ({ children }) => (
    <h3 className="text-[18px] font-bold tracking-[-0.01em] text-black mt-8 mb-3">
      {children}
    </h3>
  ),

  // Text
  p: ({ children }) => (
    <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-black">{children}</strong>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc ml-5 space-y-2 text-[15px] text-text-secondary leading-relaxed mb-4 marker:text-text-muted">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 space-y-2 text-[15px] text-text-secondary leading-relaxed mb-4 marker:text-text-muted marker:font-mono marker:font-bold">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1.5">{children}</li>,

  // Links
  a: ({ href, children, ...props }) => {
    if (href && href.startsWith("/")) {
      return (
        <Link
          href={href}
          className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Table
  table: ({ children }) => (
    <div className="border border-border-light overflow-x-auto my-8">
      <table className="w-full text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="text-left bg-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-5 py-3">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-5 py-3.5 text-[14px] text-text-secondary border-t border-border-light">
      {children}
    </td>
  ),

  // Code
  code: ({ children }) => (
    <code className="bg-zinc-100 text-[13px] font-mono px-1.5 py-0.5 text-zinc-800 rounded-sm border border-zinc-200">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-zinc-950 text-zinc-100 border border-zinc-800 overflow-x-auto p-5 my-8 text-[13px] font-mono leading-relaxed rounded-sm">
      {children}
    </pre>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-black bg-surface/50 px-6 py-5 my-8 text-[16px] text-text-secondary leading-relaxed italic">
      {children}
    </blockquote>
  ),

  // Custom components
  Callout,
  ComparisonTable,
  CodeBlock,
  FrameTransactionScene,
  PaymasterFlow,
  MempoolLayers,
  EIPTimeline,
  EIPTimeline3D,
  PrivacyDiagram,
  BeforeAfterScene,
  FrameFlow,
  FlowNormalTx,
  FlowAtomicOps,
  FlowNewAccount,
  FlowPrivacyZK,
  StatsOverview,
  StatsUnlocked,
  EOABenefits,
  CapabilityCards,
  FOCILComparison,
  QuantumComparison,
  HegotaSummary,
  // Scaling article
  RoadmapStaircase3D,
  ParallelVerification3D,
  EPBSSlotClock3D,
  GasEvolution3D,
  BlobSampling3D,
  ZKEVMPopulation3D,
  EOFContainerization3D,
  FullStackLayers3D,
  ScalingStats,
  ScalingSummary,
  AccessListConflict3D,
  SlotBudget3D,
  ErasureCoding3D,
  GasReservoir3D,
  ProverConsensus3D,
  // EIP-8141 article (new 3D scenes)
  NormalVsFrame3D,
  FrameOverview3D,
  MultisigAuth3D,
  AccountDeploy3D,
  PaymasterFlow3D: PaymasterFlow3DNew,
  ZKPrivacy3D,
  FOCILGuard3D,
  AtomicBatch3D,
  PromiseScene3D,
  PayoffScene3D,
  HistoryTimeline3D,
  SocialProof3D,
  // Founders demographics article
  FoundersStats,
  FoundersAgeTimeline,
  TGEAgePerformance,
  TeamCompPerformanceGrid,
  TeamGenderPerformance,
  TeamNatPerformance,
  TeamAgeSpreadPerformance,
  TeamEduPerformance,
};
