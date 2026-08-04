import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  copyRecoveryCode,
  getSafeStatusHref,
  RecoveryScreen,
} from "./RecoveryScreen";

const baseProps = {
  title: "Bir şeyler ters gitti",
  description: "Bu ekran şu anda açılamadı.",
  code: "MAS-UI-500",
  homeHref: "/dashboard",
  homeLabel: "Panoya dön",
} as const;

test("error surface prioritizes retry and exposes only the public code", () => {
  const markup = renderToStaticMarkup(
    createElement(RecoveryScreen, {
      ...baseProps,
      kind: "error",
      onRetry: () => undefined,
    }),
  );

  assert.match(markup, /Sistem hatası/);
  assert.match(markup, /MAS-UI-500/);
  assert.match(markup, /Tekrar dene/);
  assert.ok(markup.indexOf("Tekrar dene") < markup.indexOf("Panoya dön"));
  assert.doesNotMatch(markup, /digest|stack trace|error\.message/i);
});

test("recovery surface uses the official Masabu wordmark", () => {
  const markup = renderToStaticMarkup(
    createElement(RecoveryScreen, {
      ...baseProps,
      kind: "error",
    }),
  );

  assert.match(markup, /<img[^>]+alt="Masabu"/);
  assert.match(markup, /data:image\/png;base64/);
  assert.doesNotMatch(markup, /mas-recovery-brand-mark/);
});

test("not-found surface has one primary navigation action and a 404 watermark", () => {
  const markup = renderToStaticMarkup(
    createElement(RecoveryScreen, {
      ...baseProps,
      kind: "not-found",
      code: "MAS-ROUTE-404",
    }),
  );

  assert.match(markup, /Sayfa bulunamadı/);
  assert.match(markup, />404</);
  assert.match(markup, /lucide-triangle-alert/);
  assert.doesNotMatch(markup, /lucide-compass/);
  assert.match(markup, /mas-recovery-button-primary/);
  assert.doesNotMatch(markup, /Tekrar dene/);
});

test("dark appearance remains self-contained", () => {
  const markup = renderToStaticMarkup(
    createElement(RecoveryScreen, {
      ...baseProps,
      kind: "error",
      appearance: "dark",
    }),
  );

  assert.match(markup, /data-appearance="dark"/);
  assert.match(markup, /--recovery-page: #111315/);
});

test("status link accepts only credential-free HTTPS URLs", () => {
  assert.equal(
    getSafeStatusHref("https://status.masabu.com/"),
    "https://status.masabu.com/",
  );
  assert.equal(getSafeStatusHref("http://status.masabu.com"), null);
  assert.equal(
    getSafeStatusHref("https://user:secret@status.masabu.com"),
    null,
  );
  assert.equal(getSafeStatusHref("javascript:alert(1)"), null);
  assert.equal(getSafeStatusHref(undefined), null);

  const markup = renderToStaticMarkup(
    createElement(RecoveryScreen, {
      ...baseProps,
      kind: "error",
      statusHref: "javascript:alert(1)",
    }),
  );
  assert.doesNotMatch(markup, /sistem durumunu kontrol edin/);
});

test("clipboard result is truthful for success, rejection and unavailable APIs", async () => {
  let written = "";
  assert.equal(
    await copyRecoveryCode("MAS-UI-500", {
      writeText: async (value) => {
        written = value;
      },
    }),
    "copied",
  );
  assert.equal(written, "MAS-UI-500");
  assert.equal(
    await copyRecoveryCode("MAS-UI-500", {
      writeText: async () => {
        throw new Error("denied");
      },
    }),
    "failed",
  );
  assert.equal(await copyRecoveryCode("MAS-UI-500"), "failed");
});

test("retry action blocks duplicate submissions while reset is running", () => {
  const source = readFileSync(
    new URL("./RecoveryScreen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /if \(!onRetry \|\| retrying\) return/);
  assert.match(source, /disabled=\{retrying\}/);
  assert.match(source, /Yeniden deneniyor…/);
});
