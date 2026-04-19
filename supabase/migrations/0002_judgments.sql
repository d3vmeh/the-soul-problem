create table judgments (
  id serial primary key,
  response_id int references responses(id) on delete cascade,
  judge_model text not null,
  overall_score real not null,
  positive_scores jsonb not null,
  negative_scores jsonb not null,
  dominant_criteria jsonb not null,
  aggregation jsonb not null,
  rationale text,
  raw_output text,
  created_at timestamptz default now(),
  unique (response_id, judge_model)
);

create index judgments_response_idx on judgments(response_id);
create index judgments_model_idx on judgments(judge_model);

alter table judgments enable row level security;
