import test from "node:test";
import assert from "node:assert/strict";
import {
  addBookmark,
  getLessonBySlug,
  submitQuizAttempt,
  updateLessonProgress,
} from "../src/services/learningService";

test("learning service rejects malformed lesson slugs before making a request", async () => {
  await assert.rejects(() => getLessonBySlug("Not A Slug"), /valid lesson slug/);
});

test("learning service validates lesson identifiers before authentication", async () => {
  await assert.rejects(() => addBookmark("not-a-uuid"), /valid identifier/);
  await assert.rejects(() => updateLessonProgress("not-a-uuid", {
    progressPercentage: 25,
    lastPosition: 10,
  }), /valid identifier/);
});

test("learning service validates progress and quiz constraints", async () => {
  await assert.rejects(() => updateLessonProgress("00000000-0000-4000-8000-000000000000", {
    progressPercentage: 101,
    lastPosition: 0,
  }), /0 to 100/);
  await assert.rejects(() => submitQuizAttempt("00000000-0000-4000-8000-000000000000", {
    score: 4,
    totalQuestions: 3,
    answers: [],
  }), /between zero and the total/);
});
