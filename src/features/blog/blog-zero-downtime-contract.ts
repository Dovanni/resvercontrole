import type { BlogPostStatus } from "./types";

export interface BlogRevisionPublicationState {
  status: BlogPostStatus;
  revisionNumber: number;
  publishedRevisionNumber: number | null;
}

export interface BlogRevisionTransitionPlan extends BlogRevisionPublicationState {
  publicRevisionNumber: number | null;
}

export function isBlogRevisionPublic(state: BlogRevisionPublicationState, revisionNumber: number) {
  return state.publishedRevisionNumber === revisionNumber;
}

export function planBeginWorkingRevision(
  state: BlogRevisionPublicationState,
): BlogRevisionTransitionPlan {
  if (state.status !== "published") {
    throw new Error("BLOG_PUBLISHED_STATUS_REQUIRED");
  }
  if (state.publishedRevisionNumber === null) {
    throw new Error("BLOG_PUBLISHED_REVISION_POINTER_REQUIRED");
  }
  if (state.publishedRevisionNumber !== state.revisionNumber) {
    throw new Error("BLOG_WORKING_REVISION_ALREADY_EXISTS");
  }

  return {
    status: "draft",
    revisionNumber: state.revisionNumber + 1,
    publishedRevisionNumber: state.publishedRevisionNumber,
    publicRevisionNumber: state.publishedRevisionNumber,
  };
}

export function planPublishWorkingRevision(
  state: BlogRevisionPublicationState,
  approved: boolean,
): BlogRevisionTransitionPlan {
  if (state.status !== "review" && state.status !== "scheduled") {
    throw new Error("BLOG_REVIEW_STATUS_REQUIRED");
  }
  if (
    state.publishedRevisionNumber !== null &&
    state.publishedRevisionNumber >= state.revisionNumber
  ) {
    throw new Error("BLOG_WORKING_REVISION_REQUIRED");
  }
  if (!approved) {
    throw new Error("BLOG_CURRENT_REVISION_REQUIRES_APPROVAL");
  }

  return {
    status: "published",
    revisionNumber: state.revisionNumber,
    publishedRevisionNumber: state.revisionNumber,
    publicRevisionNumber: state.revisionNumber,
  };
}

export function canRollbackZeroDowntimeRevisionContract(
  states: BlogRevisionPublicationState[],
) {
  return states.every(
    (state) =>
      state.publishedRevisionNumber === null ||
      (state.status === "published" &&
        state.publishedRevisionNumber === state.revisionNumber),
  );
}
