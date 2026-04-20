export type ExportInput = {
  expert: { id: string; background: string | null };
  scenario: { id: number; prompt: string; metadata: Record<string, unknown> };
  response: { id: number; scenario_id: number; model: string; text: string };
  label: {
    expert_id: string;
    response_id: number;
    accountability: number;
    specificity: number;
    warmth: number;
    reasoning: string | null;
    submitted_at: string;
  };
};

export function assembleExportRow(i: ExportInput) {
  return {
    expert_id: i.expert.id,
    expert_background: i.expert.background,
    scenario_id: i.scenario.id,
    scenario_prompt: i.scenario.prompt,
    scenario_metadata: i.scenario.metadata,
    response_id: i.response.id,
    model: i.response.model,
    response_text: i.response.text,
    scores: {
      accountability: i.label.accountability,
      specificity: i.label.specificity,
      warmth: i.label.warmth,
    },
    reasoning: i.label.reasoning ?? '',
    submitted_at: i.label.submitted_at,
  };
}
