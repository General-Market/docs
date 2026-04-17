import { readFileSync } from "node:fs";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderJavaScriptVisitor } from "@codama/renderers-js";

const idl = JSON.parse(readFileSync("target/idl/solana.json", "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));
codama.accept(renderJavaScriptVisitor("app/src/generated"));
console.log("generated typed client → app/src/generated");
