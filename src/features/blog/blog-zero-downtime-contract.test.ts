import { describe, expect, it } from "vitest";
import {
  canRollbackZeroDowntimeRevisionContract,
  isBlogRevisionPublic,
  planBeginWorkingRevision,
  planPublishWorkingRevision,
} from "./blog-zero-downtime-contract";

describe("Blog Editorial V2 zero-downtime revision contract", () => {
  it("keeps revision 2 public while revision 3 starts as draft", () => {
    const published = {
      status: "published" as const,
      revisionNumber: 2,
      publishedRevisionNumber: 2,
    };

    const working = planBeginWorkingRevision(published);

    expect(working.status).toBe("draft");
    expect(working.revisionNumber).toBe(3);
    expect(working.publishedRevisionNumber).toBe(2);
    expect(working.publicRevisionNumber).toBe(2);
    expect(isBlogRevisionPublic(working, 2)).toBe(true);
    expect(isBlogRevisionPublic(working, 3)).toBe(false);
  });

  it("does not allow a second working revision to be opened concurrently", () => {
    expect(() =>
      planBeginWorkingRevision({
        status: "published",
        revisionNumber: 3,
        publishedRevisionNumber: 2,
      }),
    ).toThrow("BLOG_WORKING_REVISION_ALREADY_EXISTS");
  });

  it("keeps the published pointer unchanged while working revision is in review", () => {
    const review = {
      status: "review" as const,
      revisionNumber: 3,
      publishedRevisionNumber: 2,
    };

    expect(isBlogRevisionPublic(review, 2)).toBe(true);
    expect(isBlogRevisionPublic(review, 3)).toBe(false);
  });

  it("refuses to promote an unapproved working revision", () => {
    expect(() =>
      planPublishWorkingRevision(
        {
          status: "review",
          revisionNumber: 3,
          publishedRevisionNumber: 2,
        },
        false,
      ),
    ).toThrow("BLOG_CURRENT_REVISION_REQUIRES_APPROVAL");
  });

  it("atomically promotes the approved working revision to the public pointer", () => {
    const promoted = planPublishWorkingRevision(
      {
        status: "review",
        revisionNumber: 3,
        publishedRevisionNumber: 2,
      },
      true,
    );

    expect(promoted.status).toBe("published");
    expect(promoted.revisionNumber).toBe(3);
    expect(promoted.publishedRevisionNumber).toBe(3);
    expect(promoted.publicRevisionNumber).toBe(3);
    expect(isBlogRevisionPublic(promoted, 2)).toBe(false);
    expect(isBlogRevisionPublic(promoted, 3)).toBe(true);
  });

  it("does not reuse approval semantics when no working revision exists", () => {
    expect(() =>
      planPublishWorkingRevision(
        {
          status: "review",
          revisionNumber: 2,
          publishedRevisionNumber: 2,
        },
        true,
      ),
    ).toThrow("BLOG_WORKING_REVISION_REQUIRED");
  });

  it("blocks structural rollback while a working revision is separated from publication", () => {
    expect(
      canRollbackZeroDowntimeRevisionContract([
        {
          status: "draft",
          revisionNumber: 3,
          publishedRevisionNumber: 2,
        },
      ]),
    ).toBe(false);
  });

  it("allows structural rollback only when publication and current revision are reconciled", () => {
    expect(
      canRollbackZeroDowntimeRevisionContract([
        {
          status: "published",
          revisionNumber: 3,
          publishedRevisionNumber: 3,
        },
        {
          status: "draft",
          revisionNumber: 1,
          publishedRevisionNumber: null,
        },
      ]),
    ).toBe(true);
  });
});
