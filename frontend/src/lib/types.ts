// Kept in sync with backend/api/main.py's Pydantic models and
// docs/API_CONTRACT.md by hand — that doc is the source of truth.

export type Jurisdiction = "india" | "international";

export function jurisdictionLabel(j: Jurisdiction): string {
  return j === "india" ? "India" : "International";
}

export function jurisdictionRulesLabel(j: Jurisdiction): string {
  return j === "india" ? "National" : "International";
}

export const FORMULATION_CATEGORIES = [
  "Classical medicine",
  "Patent & Proprietary (P&P) medicine",
  "New / non-classical drug",
  "Phytopharmaceutical",
  "Ayurveda-Aahar / nutraceutical",
  "Cosmetic",
] as const;

export type FormulationCategory = (typeof FORMULATION_CATEGORIES)[number];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Citation {
  chunk_id: string;
  source_file: string;
  page_number: number;
  section_heading: string;
  exact_snippet: string;
}

export interface Flags {
  abstained: boolean;
  retried: boolean;
  weak_grounding: boolean;
}

export interface RelatedProvision {
  tag: string;
  relation: "cross_jurisdiction_counterpart" | "co_occurs_with";
  source_file: string;
  page_number: number;
  section_heading: string;
  jurisdiction: Jurisdiction;
}

export interface FormCard {
  form_id: string;
  agency: string;
  jurisdiction: Jurisdiction;
  title: string;
  statutory_mandate: string;
  submission_portal: string;
  required_attachments: string[];
  deadline: string;
}

export interface ComplianceFlag {
  tag: string;
  note: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  flags: Flags;
  formulation_category: string;
  formulation_notes: string[];
  confidence_score: number;
  audio_base64: string | null;
  related_provisions: RelatedProvision[];
  needs_clarification: boolean;
  clarifying_questions: string[];
  actionable_forms: FormCard[];
  compliance_flags: ComplianceFlag[];
}

export interface QueryRequest {
  question: string;
  history?: ChatTurn[];
  jurisdiction?: Jurisdiction;
  language?: string;
  synthesize_audio?: boolean;
}

export type StreamDoneData = Omit<QueryResponse, "audio_base64">;

export interface TranscribeResponse {
  transcript: string;
  detected_language: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  flags?: Flags;
  formulation_category?: string;
  formulation_notes?: string[];
  confidence_score?: number;
  related_provisions?: RelatedProvision[];
  needs_clarification?: boolean;
  clarifying_questions?: string[];
  actionable_forms?: FormCard[];
  compliance_flags?: ComplianceFlag[];
  error?: string;
  retryable?: boolean;
  retryQuestion?: string;
  pending?: boolean;
}
