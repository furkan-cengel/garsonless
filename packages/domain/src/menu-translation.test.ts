import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveMenuLocale,
  translatedMenuText,
  validateTranslationText,
  translationFieldStatus,
} from "./menu-translation";
test("menu language precedence, supported language matching and disabled plan", () => {
  assert.equal(
    resolveMenuLocale({
      enabled: true,
      explicit: "tr",
      saved: "en",
      acceptLanguage: "en-US",
    }),
    "tr",
  );
  assert.equal(
    resolveMenuLocale({
      enabled: true,
      explicit: "de",
      saved: "en",
      acceptLanguage: "tr",
    }),
    "en",
  );
  assert.equal(
    resolveMenuLocale({
      enabled: true,
      acceptLanguage: "de;q=1,en-US;q=0.9,tr;q=0.1",
    }),
    "en",
  );
  assert.equal(
    resolveMenuLocale({ enabled: true, acceptLanguage: "en;q=0,tr;q=0.8" }),
    "tr",
  );
  assert.equal(
    resolveMenuLocale({ enabled: false, explicit: "en", saved: "en" }),
    "tr",
  );
});
test("stale sources never receive a published translation", () => {
  const data = {
    enabled: true,
    revision: 1,
    fields: { name: { source: "Çay", text: "Tea" } },
  };
  assert.equal(translatedMenuText(data, "en", "name", "Çay"), "Tea");
  assert.equal(
    translatedMenuText(data, "en", "name", "Yeşil çay"),
    "Yeşil çay",
  );
  assert.equal(translatedMenuText(data, "tr", "name", "Çay"), "Çay");
  assert.equal(
    translatedMenuText({ ...data, enabled: false }, "en", "name", "Çay"),
    "Çay",
  );
});
test("translation validation preserves quantities and disallows markup", () => {
  assert.ok(validateTranslationText("250 g yoğurt", "250 g yoghurt"));
  assert.equal(validateTranslationText("250 g yoğurt", "500 g yoghurt"), false);
  assert.equal(validateTranslationText("Çay", "<b>Tea</b>"), false);
  assert.equal(validateTranslationText("Çay", ""), false);
});
test("source changes preserve manual drafts but require review again", () => {
  const f = {
    key: "a",
    label: "Çay",
    source: "Çay",
    sourceVersion: 2,
    version: 3,
    draft: "Tea",
    draftSourceVersion: 1,
    published: "Tea",
    publishedSourceVersion: 1,
  };
  assert.equal(translationFieldStatus(f), "stale");
  assert.equal(
    translationFieldStatus({ ...f, draftSourceVersion: 2 }),
    "draft",
  );
  assert.equal(
    translationFieldStatus({
      ...f,
      draftSourceVersion: 2,
      publishedSourceVersion: 2,
    }),
    "published",
  );
});
