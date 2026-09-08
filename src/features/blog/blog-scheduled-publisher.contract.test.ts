import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260908150600_blog_scheduled_publisher.sql"),
  "utf8",
);
const rollback = readFileSync(
  resolve(process.cwd(), "supabase/rollback/20260908150600_blog_scheduled_publisher.rollback.sql"),
  "utf8",
);

describe("R9 scheduled publisher repository contract", () => {
  it("keeps the publisher private and unavailable to exposed API roles", () => {
    expect(migration).toContain("create or replace function blog_private.publish_due_scheduled_posts");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public, blog_private, pg_temp");
    expect(migration).toContain("from public, anon, authenticated, service_role;");
  });

  it("selects only due scheduled rows and protects concurrent workers", () => {
    expect(migration).toContain("where p.status = 'scheduled'");
    expect(migration).toContain("p.scheduled_at <= now()");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("limit p_limit");
  });

  it("requires approval of the current revision and therefore rejects stale approvals", () => {
    expect(migration).toContain("r.revision_number = _post.revision_number");
    expect(migration).toContain("_latest_review_decision is distinct from 'approved'");
    expect(migration).toContain("BLOG_CURRENT_REVISION_REQUIRES_APPROVAL");
  });

  it("fails closed when publication requirements are incomplete", () => {
    expect(migration).toContain("BLOG_PUBLISHING_REQUIREMENTS_NOT_MET");
    expect(migration).toContain("jsonb_array_length(_post.content)=0");
    expect(migration).toContain("skipped_requirements");
  });

  it("changes only workflow state and leaves content, revision and SEO untouched", () => {
    expect(migration).toContain("set status='published'");
    expect(migration).not.toContain("set content=");
    expect(migration).not.toContain("set revision_number=");
    expect(migration).not.toContain("set seo_allow_indexing=");
    expect(migration).not.toContain("set seo_allow_following=");
    expect(migration).not.toContain("set seo_include_in_sitemap=");
  });

  it("records scheduler provenance without impersonating a human", () => {
    expect(migration).toContain("add column actor_source text not null default 'human'");
    expect(migration).toContain("_actor_source := 'scheduler'");
    expect(migration).toContain("_actor_user_id := null");
  });

  it("deduplicates deterministic skip audit rows per post revision and reason", () => {
    expect(migration).toContain("create unique index blog_scheduled_publication_attempts_skip_once_uidx");
    expect(migration).toContain("(post_id, revision_number, outcome, error_code)");
    expect(migration).toContain("where outcome in ('skipped_no_approval', 'skipped_requirements')");
    expect(migration).toContain("on conflict (post_id, revision_number, outcome, error_code)");
    expect(migration).toContain("do nothing;");
  });

  it("allows a new revision to create a fresh skip audit record", () => {
    expect(migration).toContain("post_id, revision_number, outcome, error_code");
  });

  it("does not install or activate any scheduler", () => {
    expect(migration).not.toContain("cron.schedule");
    expect(migration).not.toContain("pg_cron");
    expect(migration).not.toContain("pg_net");
  });

  it("ships an explicit rollback for the R9 schema objects", () => {
    expect(rollback).toContain("drop function if exists blog_private.publish_due_scheduled_posts(integer)");
    expect(rollback).toContain("drop table if exists blog_private.blog_scheduled_publication_attempts");
    expect(rollback).toContain("drop constraint if exists blog_workflow_events_actor_source_check");
    expect(rollback).toContain("drop column if exists actor_source");
    expect(rollback).toContain("create or replace function blog_private.capture_blog_workflow_event()");
  });
});
