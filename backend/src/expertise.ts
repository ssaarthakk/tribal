import type { Db } from "./db.js";
import {
  ADD_AUTHORED_PR_EXPERTISE,
  ADD_COMMIT_EXPERTISE,
  ADD_ISSUE_COMMENT_EXPERTISE,
  ADD_PR_COMMENT_EXPERTISE,
  ADD_REVIEW_COLLABORATION,
  ADD_REVIEW_EXPERTISE,
  ADD_SHARED_EXPERTISE_COLLABORATION,
  DELETE_COLLABORATION,
  DELETE_KNOWS_ABOUT,
  MARK_EXPERTS,
  SET_BUS_FACTOR,
} from "./queries.js";

export const SCORING = {
  commitWeight: 1.0,
  authoredPrWeight: 0.8,
  reviewWeight: 0.6,
  commentWeight: 0.2,
  halfLifeDays: 180,
  expertShare: 0.1,
  activeDays: 365,
  sharedExpertiseWeight: 0.5,
  riskMapMinShare: 0.05,
} as const;

export async function computeExpertise(db: Db, now: number): Promise<void> {
  const activities = [
    [ADD_COMMIT_EXPERTISE, SCORING.commitWeight],
    [ADD_AUTHORED_PR_EXPERTISE, SCORING.authoredPrWeight],
    [ADD_REVIEW_EXPERTISE, SCORING.reviewWeight],
    [ADD_PR_COMMENT_EXPERTISE, SCORING.commentWeight],
    [ADD_ISSUE_COMMENT_EXPERTISE, SCORING.commentWeight],
  ] as const;

  await db.write(DELETE_KNOWS_ABOUT);
  for (const [cypher, weight] of activities) {
    await db.write(cypher, {
      now,
      halfLifeDays: SCORING.halfLifeDays,
      weight,
    });
  }
  await db.write(MARK_EXPERTS, {
    now,
    expertShare: SCORING.expertShare,
    activeDays: SCORING.activeDays,
  });
  await db.write(SET_BUS_FACTOR);
  await db.write(DELETE_COLLABORATION);
  await db.write(ADD_REVIEW_COLLABORATION);
  await db.write(ADD_SHARED_EXPERTISE_COLLABORATION, {
    weight: SCORING.sharedExpertiseWeight,
  });
}
