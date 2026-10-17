import { z } from "zod";

export const RiskLevelSchema = z.enum([
  "orphaned",
  "critical",
  "at_risk",
  "healthy",
]);
export const PersonRefSchema = z.object({
  id: z.string(),
  login: z.string().nullable(),
  name: z.string(),
});
export const ComponentSummarySchema = z.object({
  path: z.string(),
  name: z.string(),
  busFactor: z.number().int(),
  risk: RiskLevelSchema,
});
export const RiskMapLinkSchema = z.object({
  personId: z.string(),
  componentPath: z.string(),
  score: z.number(),
  share: z.number(),
  expert: z.boolean(),
});
export const RiskMapSchema = z.object({
  people: z.array(PersonRefSchema),
  components: z.array(ComponentSummarySchema),
  links: z.array(RiskMapLinkSchema),
});
export const ExpertiseSchema = z.object({
  person: PersonRefSchema,
  score: z.number(),
  share: z.number(),
  lastActive: z.string(),
  expert: z.boolean(),
});
export const ExpertRowSchema = PersonRefSchema.extend({
  score: z.number(),
  share: z.number(),
  lastActive: z.number(),
  expert: z.boolean(),
});
export const DecisionViewSchema = z.object({
  id: z.string(),
  summary: z.string(),
  rationale: z.string(),
  status: z.enum(["active", "superseded"]),
  decidedAt: z.string(),
  sourceUrl: z.string(),
  madeBy: z.array(z.string()),
  supersedes: z.array(z.string()),
});
export const DocRefSchema = z.object({
  path: z.string(),
  title: z.string(),
  url: z.string(),
  updatedAt: z.string(),
});
export const PullRequestRefSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
  createdAt: z.string(),
});
export const ComponentDetailSchema = z.object({
  component: ComponentSummarySchema,
  experts: z.array(ExpertiseSchema),
  decisions: z.array(DecisionViewSchema),
  docs: z.array(DocRefSchema),
  recentPullRequests: z.array(PullRequestRefSchema),
});
export const WorkItemSchema = z.object({
  kind: z.enum(["pr", "issue"]),
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
});
export const PersonComponentSchema = z.object({
  componentPath: z.string(),
  score: z.number(),
  share: z.number(),
  lastActive: z.string(),
  expert: z.boolean(),
});
export const PersonDetailSchema = z.object({
  person: PersonRefSchema,
  components: z.array(PersonComponentSchema),
  decisions: z.array(DecisionViewSchema),
  openWork: z.array(WorkItemSchema),
});
export const SuccessorSchema = z.object({
  person: PersonRefSchema,
  score: z.number(),
  lastActive: z.string(),
});
export const AffectedComponentSchema = z.object({
  path: z.string(),
  busFactorBefore: z.number().int(),
  busFactorAfter: z.number().int(),
  riskAfter: RiskLevelSchema,
  successors: z.array(SuccessorSchema),
});
export const OrphanedDecisionSchema = z.object({
  id: z.string(),
  summary: z.string(),
  sourceUrl: z.string(),
  decidedAt: z.string(),
  affects: z.array(z.string()),
});
export const CollaboratorSchema = z.object({
  person: PersonRefSchema,
  weight: z.number(),
});
export const DepartureReportSchema = z.object({
  person: PersonRefSchema,
  affectedComponents: z.array(AffectedComponentSchema),
  orphaned: z.array(z.string()),
  critical: z.array(z.string()),
  decisionsLosingOwner: z.array(OrphanedDecisionSchema),
  openWork: z.array(WorkItemSchema),
  nearbyCollaborators: z.array(CollaboratorSchema),
});
export const RankedPersonSchema = z.object({
  person: PersonRefSchema,
  pageRank: z.number(),
  betweenness: z.number(),
});
export const TeamRankingSchema = z.array(RankedPersonSchema);
export const SearchHitSchema = z.object({
  kind: z.enum(["pr", "issue", "decision", "doc"]),
  key: z.string(),
  title: z.string(),
  url: z.string(),
  score: z.number(),
});
export const SourceSchema = z.object({ title: z.string(), url: z.string() });
export const TopicComponentSchema = z.object({
  path: z.string(),
  relevance: z.number(),
  experts: z.array(ExpertiseSchema),
});
export const WhoKnowsSchema = z.object({
  components: z.array(TopicComponentSchema),
  sources: z.array(SourceSchema),
});
export const PersonIdRequestSchema = z.object({
  personId: z.string().min(1).max(200),
});

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ComponentSummary = z.infer<typeof ComponentSummarySchema>;
export type RiskMap = z.infer<typeof RiskMapSchema>;
export type DecisionView = z.infer<typeof DecisionViewSchema>;
export type ComponentDetail = z.infer<typeof ComponentDetailSchema>;
export type PersonDetail = z.infer<typeof PersonDetailSchema>;
export type DepartureReport = z.infer<typeof DepartureReportSchema>;
export type TeamRanking = z.infer<typeof TeamRankingSchema>;
export type Expertise = z.infer<typeof ExpertiseSchema>;
export type SearchHit = z.infer<typeof SearchHitSchema>;
export type WhoKnows = z.infer<typeof WhoKnowsSchema>;

export function riskLevel(busFactor: number): RiskLevel {
  if (busFactor <= 0) return "orphaned";
  if (busFactor === 1) return "critical";
  if (busFactor === 2) return "at_risk";
  return "healthy";
}

export function toIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export function toExpertise({
  score,
  share,
  lastActive,
  expert,
  ...person
}: z.infer<typeof ExpertRowSchema>): Expertise {
  return { person, score, share, lastActive: toIso(lastActive), expert };
}
