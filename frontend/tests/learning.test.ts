import assert from "node:assert/strict";
import test from "node:test";
import { lessons, lessonById } from "../src/learning/lessons";

test("published lessons contain the required educational sections", () => {
  assert.equal(lessons.length, 3);
  for (const lesson of lessons) {
    assert.ok(lesson.objectives.length >= 3);
    assert.ok(lesson.introduction.length > 40);
    assert.ok(lesson.simpleExplanation.length > 40);
    assert.ok(lesson.technicalExplanation.length > 40);
    assert.ok(lesson.exampleCode.length > 10);
    assert.ok(lesson.commonMistakes.length >= 2);
    assert.ok(lesson.applications.length >= 2);
    assert.equal(lesson.quiz.options.length, 4);
    assert.ok(lesson.quiz.answer >= 0 && lesson.quiz.answer < lesson.quiz.options.length);
  }
});

test("lesson ids are stable and resolve through the content catalog", () => {
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length);
  assert.equal(lessonById["variables-and-state"]?.title, "Variables and program state");
  assert.equal(lessonById["missing-lesson"], undefined);
});

