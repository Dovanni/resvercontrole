import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const migration=readFileSync(resolve(process.cwd(),"supabase/migrations/20260908150600_blog_scheduled_publisher.sql"),"utf8");
const rollback=readFileSync(resolve(process.cwd(),"supabase/rollback/20260908150600_blog_scheduled_publisher.rollback.sql"),"utf8");
describe("R9 scheduled publisher repository contract",()=>{
 it("keeps publisher private",()=>{expect(migration).toContain("security definer");expect(migration).toContain("set search_path=pg_catalog,public,blog_private,pg_temp");expect(migration).toContain("from public,anon,authenticated,service_role")});
 it("publishes only due scheduled rows with concurrent-worker locking",()=>{expect(migration).toContain("p.status='scheduled'");expect(migration).toContain("p.scheduled_at<=now()");expect(migration).toContain("for update skip locked")});
 it("requires current revision approval",()=>{expect(migration).toContain("r.revision_number=_post.revision_number");expect(migration).toContain("BLOG_CURRENT_REVISION_REQUIRES_APPROVAL")});
 it("fails closed on incomplete requirements",()=>{expect(migration).toContain("BLOG_PUBLISHING_REQUIREMENTS_NOT_MET");expect(migration).toContain("jsonb_array_length(_post.content)=0")});
 it("preserves content revision and SEO",()=>{expect(migration).toContain("set status='published'");expect(migration).not.toContain("set content=");expect(migration).not.toContain("set revision_number=");expect(migration).not.toContain("set seo_allow_indexing=")});
 it("records scheduler without human impersonation",()=>{expect(migration).toContain("_actor_source:='scheduler'");expect(migration).toContain("_actor_user_id:=null")});
 it("deduplicates deterministic skips without ambiguous PLpgSQL conflict target",()=>{expect(migration).toContain("create unique index blog_scheduled_publication_attempts_skip_once_uidx");expect(migration).toContain("on conflict do nothing");expect(migration).not.toContain("on conflict (post_id");});
 it("does not activate scheduler",()=>{expect(migration).not.toContain("cron.schedule");expect(migration).not.toContain("pg_cron");expect(migration).not.toContain("pg_net")});
 it("ships rollback",()=>{expect(rollback).toContain("drop function if exists blog_private.publish_due_scheduled_posts(integer)");expect(rollback).toContain("drop table if exists blog_private.blog_scheduled_publication_attempts");expect(rollback).toContain("drop column if exists actor_source")});
});
