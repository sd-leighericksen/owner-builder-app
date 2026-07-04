/**
 * VIC jurisdiction content (brief §6). State-specific content is DATA, not code:
 * it lives in the database, keyed by state, and is editable via the app. This
 * file is only the initial seed.
 *
 * IMPORTANT: checklist items are a checklist aid, not legal advice. Each item
 * carries a source_url; `lastVerifiedAt` is set when a human has verified the
 * item against current VBA / Consumer Affairs Victoria guidance. Items seeded
 * with lastVerifiedAt = null MUST be verified before being relied on.
 */

export const VIC_STAGE_TEMPLATE: string[] = [
  "Planning & Permits",
  "Site Works",
  "Footings & Slab",
  "Frame",
  "Roofing",
  "Lockup",
  "Services Rough-in",
  "Fixing",
  "Wet Areas & Waterproofing",
  "External Works",
  "Completion & Handover",
];

export const AU_RESIDENTIAL_BUDGET_CATEGORIES: Array<{
  code: string;
  name: string;
  isContingency?: boolean;
}> = [
  { code: "01", name: "Site Works" },
  { code: "02", name: "Slab & Footings" },
  { code: "03", name: "Frame" },
  { code: "04", name: "Roofing" },
  { code: "05", name: "Lockup" },
  { code: "06", name: "Services Rough-in" },
  { code: "07", name: "Fixing" },
  { code: "08", name: "Wet Areas" },
  { code: "09", name: "External Works" },
  { code: "10", name: "Fees, Permits & Insurance" },
  { code: "11", name: "Contingency", isContingency: true },
];

export interface ChecklistSeedItem {
  appliesToStage: string | null; // matches a VIC_STAGE_TEMPLATE name, null = project-wide
  title: string;
  description: string;
  helpUrl: string;
  sourceUrl: string;
  required: boolean;
  itemKind: "task" | "inspection" | "document";
  lastVerifiedAt: string | null; // ISO date when a human verified against VBA/CAV
}

export const VIC_CHECKLIST: { name: string; description: string; items: ChecklistSeedItem[] } = {
  name: "VIC Owner-Builder Compliance",
  description:
    "Compliance checklist for Victorian owner-builders. Checklist aid only — verify every item with the VBA and your relevant building surveyor.",
  items: [
    {
      appliesToStage: "Planning & Permits",
      title: "Obtain Certificate of Consent from the VBA",
      description:
        "Required for owner-builder domestic building work over the prescribed value threshold (historically $16,000 incl. GST). Requires completing the VBA owner-builder eLearning assessment. One certificate per person within a set period — verify current threshold and rules with the VBA.",
      helpUrl: "https://www.vba.vic.gov.au/consumers/owner-builders",
      sourceUrl: "https://www.vba.vic.gov.au/consumers/owner-builders",
      required: true,
      itemKind: "task",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Planning & Permits",
      title: "Complete construction induction (White Card)",
      description: "A White Card (construction induction training) is required for access to the building site.",
      helpUrl: "https://www.worksafe.vic.gov.au/construction-induction-training-white-card",
      sourceUrl: "https://www.worksafe.vic.gov.au/construction-induction-training-white-card",
      required: true,
      itemKind: "task",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Planning & Permits",
      title: "Building permit issued by Relevant Building Surveyor (RBS)",
      description:
        "A building permit must be issued by your RBS before works commence. Record the permit number and note commencement/completion time limits on the permit.",
      helpUrl: "https://www.vba.vic.gov.au/building/building-permits",
      sourceUrl: "https://www.vba.vic.gov.au/building/building-permits",
      required: true,
      itemKind: "document",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Planning & Permits",
      title: "Major domestic building contracts for trades over threshold",
      description:
        "Engaging a registered builder/trade above the contract value threshold (historically $10,000) requires a major domestic building contract. Keep signed contracts in the document vault per trade — verify the current threshold with Consumer Affairs Victoria.",
      helpUrl: "https://www.consumer.vic.gov.au/housing/building-and-renovating",
      sourceUrl: "https://www.consumer.vic.gov.au/housing/building-and-renovating",
      required: true,
      itemKind: "document",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Planning & Permits",
      title: "WHS: safe site checklist and SWMS on file",
      description:
        "As owner-builder you hold WHS duties for the site: maintain a safe site checklist, keep Safe Work Method Statements (SWMS) on file for high-risk construction work performed by trades, and log incidents in the site diary (tag entries as 'incident').",
      helpUrl: "https://www.worksafe.vic.gov.au/owner-builders",
      sourceUrl: "https://www.worksafe.vic.gov.au/owner-builders",
      required: true,
      itemKind: "task",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Footings & Slab",
      title: "Mandatory inspection: prior to placing footings",
      description:
        "Notify your RBS and obtain approval at this mandatory notification stage before placing footings.",
      helpUrl: "https://www.vba.vic.gov.au/building/building-permits",
      sourceUrl: "https://www.vba.vic.gov.au/building/building-permits",
      required: true,
      itemKind: "inspection",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Footings & Slab",
      title: "Mandatory inspection: prior to pouring in-situ concrete slab",
      description:
        "Notify your RBS and obtain approval at this mandatory notification stage before pouring an in-situ reinforced concrete slab.",
      helpUrl: "https://www.vba.vic.gov.au/building/building-permits",
      sourceUrl: "https://www.vba.vic.gov.au/building/building-permits",
      required: true,
      itemKind: "inspection",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Frame",
      title: "Mandatory inspection: on completion of framework",
      description: "Notify your RBS and obtain approval at this mandatory notification stage on completion of framework.",
      helpUrl: "https://www.vba.vic.gov.au/building/building-permits",
      sourceUrl: "https://www.vba.vic.gov.au/building/building-permits",
      required: true,
      itemKind: "inspection",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Services Rough-in",
      title: "Certificate of Electrical Safety from licensed electrician",
      description:
        "Electrical work must be performed by a licensed electrician who supplies a Certificate of Electrical Safety. File it before dependent stages proceed.",
      helpUrl: "https://esv.vic.gov.au/",
      sourceUrl: "https://esv.vic.gov.au/",
      required: true,
      itemKind: "document",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Services Rough-in",
      title: "Plumbing compliance certificate from licensed plumber",
      description:
        "Plumbing work must be performed by a licensed plumber who lodges a compliance certificate for work over the prescribed value. File certificates in the vault.",
      helpUrl: "https://www.vba.vic.gov.au/plumbing/compliance-certificates",
      sourceUrl: "https://www.vba.vic.gov.au/plumbing/compliance-certificates",
      required: true,
      itemKind: "document",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Wet Areas & Waterproofing",
      title: "Waterproofing certificate before fixing proceeds",
      description:
        "Obtain and file the waterproofing compliance certificate for wet areas before dependent stages (fixing) proceed.",
      helpUrl: "https://www.vba.vic.gov.au/",
      sourceUrl: "https://www.vba.vic.gov.au/",
      required: true,
      itemKind: "document",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: "Completion & Handover",
      title: "Mandatory inspection: on completion of building work",
      description:
        "Final mandatory notification stage — leads to the occupancy permit or certificate of final inspection from your RBS.",
      helpUrl: "https://www.vba.vic.gov.au/building/building-permits",
      sourceUrl: "https://www.vba.vic.gov.au/building/building-permits",
      required: true,
      itemKind: "inspection",
      lastVerifiedAt: null,
    },
    {
      appliesToStage: null,
      title: "Domestic Building Insurance awareness (selling within 6.5 years)",
      description:
        "If you sell the home within 6.5 years of completion you must obtain Domestic Building Insurance (warranty insurance) and provide a defects report. You remain liable for defects for 6 years. Keep all certificates and warranties — the handover pack depends on them.",
      helpUrl: "https://www.vmia.vic.gov.au/insurance/domestic-building-insurance",
      sourceUrl: "https://www.vmia.vic.gov.au/insurance/domestic-building-insurance",
      required: false,
      itemKind: "task",
      lastVerifiedAt: null,
    },
  ],
};

/**
 * Default AI task → model registry (brief §3). Model ids are OpenRouter
 * strings, swappable in Settings without code changes. Vision-required task
 * types must map to vision-capable models (enforced in the settings UI/API).
 */
export const DEFAULT_AI_TASK_CONFIGS = [
  {
    taskType: "quote_extraction" as const,
    modelId: "google/gemini-2.5-flash",
    fallbackModelId: "openai/gpt-4o-mini",
    requiresVision: true,
    maxTokens: 8192,
    temperature: "0.1",
  },
  {
    taskType: "receipt_capture" as const,
    modelId: "google/gemini-2.5-flash",
    fallbackModelId: "openai/gpt-4o-mini",
    requiresVision: true,
    maxTokens: 4096,
    temperature: "0.1",
  },
  {
    taskType: "risk_review" as const,
    modelId: "anthropic/claude-sonnet-4.5",
    fallbackModelId: "openai/gpt-4o",
    requiresVision: false,
    maxTokens: 8192,
    temperature: "0.3",
  },
  {
    taskType: "ask_the_build" as const,
    modelId: "anthropic/claude-sonnet-4.5",
    fallbackModelId: "openai/gpt-4o",
    requiresVision: false,
    maxTokens: 8192,
    temperature: "0.4",
  },
];
