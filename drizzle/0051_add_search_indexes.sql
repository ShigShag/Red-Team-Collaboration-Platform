-- GIN expression indexes for full-text search across engagement content
-- These are expression-based indexes (no new columns needed).
-- PostgreSQL computes the tsvector at index time.
-- Queries MUST use the exact same expression to hit the index.

-- Engagements: name + description
CREATE INDEX idx_engagements_fts ON engagements
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Category Findings: title + overview + impact + recommendation
CREATE INDEX idx_category_findings_fts ON category_findings
  USING GIN (to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(overview, '') || ' ' ||
    coalesce(impact, '') || ' ' ||
    coalesce(recommendation, '')
  ));

-- Category Actions: title + content
CREATE INDEX idx_category_actions_fts ON category_actions
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Resources: name + description
CREATE INDEX idx_resources_fts ON resources
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Scope Targets: value + notes
CREATE INDEX idx_scope_targets_fts ON scope_targets
  USING GIN (to_tsvector('english', coalesce(value, '') || ' ' || coalesce(notes, '')));

-- Finding Templates: title + overview + impact + recommendation (global, not engagement-scoped)
CREATE INDEX idx_finding_templates_fts ON finding_templates
  USING GIN (to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(overview, '') || ' ' ||
    coalesce(impact, '') || ' ' ||
    coalesce(recommendation, '')
  ));
