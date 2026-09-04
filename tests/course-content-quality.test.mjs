import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const sourceText = readFileSync(new URL("../lib/courses.ts", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("courses.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.flatMap((property) => {
      if (!ts.isPropertyAssignment(property)) return [];
      const name = propertyName(property.name);
      return name ? [[name, literalValue(property.initializer)]] : [];
    }));
  }
  return undefined;
}

function findCourse(variableName) {
  let course;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName && node.initializer) {
      course = literalValue(node.initializer);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return course;
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const peerFeedbackCourse = findCourse("givingConstructiveFeedback");

test("peer-feedback answer activities provide at least three situations", () => {
  assert.ok(peerFeedbackCourse, "Giving Constructive Feedback course must exist");
  for (const slide of peerFeedbackCourse.slides) {
    if (slide.type === "multiple-choice" || slide.type === "multi-select-quiz") {
      assert.ok(slide.rounds.length >= 3, `${slide.title} needs at least three situations`);
    }
    if (slide.type === "sorting") {
      assert.ok(slide.items.length >= 3, `${slide.title} needs at least three items`);
    }
    if (slide.type === "reflection-choice") {
      assert.ok(slide.options.length >= 3, `${slide.title} needs at least three choices`);
    }
  }
});

test("peer-feedback correct choices are not identifiable by length", () => {
  for (const slide of peerFeedbackCourse.slides.filter((item) => item.type === "multiple-choice")) {
    for (const [roundIndex, round] of slide.rounds.entries()) {
      const correct = round.options.find((option) => option.correct);
      const incorrect = round.options.filter((option) => !option.correct);
      assert.ok(correct, `${slide.title} round ${roundIndex + 1} needs a correct answer`);
      assert.equal(incorrect.length, 2, `${slide.title} round ${roundIndex + 1} needs two distractors`);
      const longestDistractor = Math.max(...incorrect.map((option) => wordCount(option.text)));
      assert.ok(
        wordCount(correct.text) <= longestDistractor + 4,
        `${slide.title} round ${roundIndex + 1} has an obviously longer correct answer`,
      );
    }
  }
});
