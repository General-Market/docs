import { notFound } from "next/navigation";
import { HandbookShell } from "../_shared";
import { isHandbookSection } from "@/lib/handbook";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isHandbookSection(section)) notFound();
  return <HandbookShell section={section}>{children}</HandbookShell>;
}
