export type Expert = {
  id: string;
  invite_token: string;
  name: string | null;
  background: string | null;
  consent_at: string | null;
  screener_passed: boolean | null;
  screener_mad: number | null;
};

export type Scenario = {
  id: number;
  prompt: string;
  metadata: Record<string, unknown>;
};

export type ModelResponse = {
  id: number;
  scenario_id: number;
  model: string;
  text: string;
};

export type ScreenerQuestion = {
  id: number;
  prompt: string;
  emotions: string[];
  reference_intensities: number[];
};

export type LabelScores = {
  accountability: number;
  specificity: number;
  warmth: number;
};
