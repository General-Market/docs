// CrxSettlementDay content pack — "Settlement in a day on CRX".
// Same choreography as the CLS reference, CRX story: trading desks with
// custody wallets instead of settlement members, on-chain custody instead
// of central-bank accounts, margin pushed to the zk-SIMM core instead of
// pay-ins, atomic on-chain settlement instead of PvP over accounts.
// Every name, number and line lives here — edit freely.
import { Pack } from "./data";

export const CRX_SANS = "Diatype, 'Helvetica Neue', Helvetica, sans-serif";

export const CRX_PACK: Pack = {
  tagline: "the on-chain FX clearing layer",
  pillars: ["Custody", "Margin", "Settlement"],
  tradeExecuted: "Forward agreed",
  priorToValueDate: "Before delivery",
  milestones: {
    m0000: { time: "00:00", label: ["Margin call computed in zero knowledge"] },
    m0630: { time: "06:30", label: ["Margin schedule", "re-proved on-chain"] },
    m0700: { time: "07:00", label: ["Settlement window", "opens on-chain"] },
    m0900: { time: "09:00", label: ["Atomic settlement", "target", "block reached"] },
    m1200: { time: "12:00", label: ["All legs delivered,", "custody released"] },
  },
  brackets: { settlement: "Atomic settlement", funding: "Margin and delivery" },
  trillion: { figure: "24", sup: "/7", unit: "no banking hours" },
  summaryRows: [
    ["Forward terms bound", "on-chain, both signatures"],
    ["Margin pushed to the core"],
    ["Both legs settle in one block"],
    ["Custody released to desks"],
  ],
  percents: ["0%", "96%", "99%"],
  members: ["A", "B", "C", "D", "E", "F", "G", "H"],
  currencyPairs: [
    { top: "USD", bottom: "JPY", topColor: "red" },
    { top: "EUR", bottom: "USD", topColor: "navy" },
    { top: "GBP", bottom: "USD", topColor: "red" },
    { top: "USD", bottom: "MXN", topColor: "navy" },
    { top: "USD", bottom: "BRL", topColor: "red" },
    { top: "EUR", bottom: "CHF", topColor: "navy" },
    { top: "USD", bottom: "KRW", topColor: "red" },
    { top: "USD", bottom: "SGD", topColor: "navy" },
    { top: "USD", bottom: "ZAR", topColor: "red" },
  ],
  serif: "Georgia, 'Times New Roman', serif",
  sans: CRX_SANS,
  brand: "crx",
};
