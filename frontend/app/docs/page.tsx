import { redirect } from "next/navigation";

/** The docs root has no page of its own — it opens on Get Started. */
export default function DocsRoot() {
  redirect("/docs/get-started");
}
