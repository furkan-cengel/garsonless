import test from "node:test";
import assert from "node:assert/strict";
import {
  createOpenAIMenuTranslationProvider,
  TranslationProviderError,
} from "./menu-translation-provider";
const fields = [
  { key: "item/a/name", label: "Yoğurt", source: "250 g yoğurt" },
];
function transport(translations: unknown, status = "completed") {
  return (async () =>
    Response.json({
      status,
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify({ translations }) },
          ],
        },
      ],
      usage: { input_tokens: 80, output_tokens: 12 },
    })) as typeof fetch;
}
test("provider uses only menu text, strict schema, fixed model and no persistence", async () => {
  const mock = (async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const input = JSON.parse(String(options?.body));
    assert.equal(input.store, false);
    assert.equal(input.model, "gpt-5.4-mini-2026-03-17");
    assert.equal(input.text.format.strict, true);
    assert.deepEqual(JSON.parse(input.input).fields, fields);
    assert.equal(input.tools, undefined);
    return transport([{ key: fields[0]!.key, text: "250 g yoghurt" }])(
      url,
      options,
    );
  }) as typeof fetch;
  const r = await createOpenAIMenuTranslationProvider(
    "test-key",
    mock,
  ).translate(fields, {});
  assert.equal(r.translations[fields[0]!.key], "250 g yoghurt");
  assert.equal(r.inputTokens, 80);
});
for (const [name, output] of [
  ["missing", []],
  [
    "duplicate",
    [
      { key: "item/a/name", text: "250 g yoghurt" },
      { key: "item/a/name", text: "250 g yoghurt" },
    ],
  ],
  ["wrong key", [{ key: "another", text: "250 g yoghurt" }]],
  ["wrong amount", [{ key: "item/a/name", text: "300 g yoghurt" }]],
  ["wrong unit", [{ key: "item/a/name", text: "250 ml yoghurt" }]],
  ["markup", [{ key: "item/a/name", text: "<b>250 g yoghurt</b>" }]],
] as const)
  test(`provider rejects ${name}`, async () => {
    await assert.rejects(
      () =>
        createOpenAIMenuTranslationProvider(
          "test",
          transport(output),
        ).translate(fields, {}),
      TranslationProviderError,
    );
  });
test("provider rejects truncation and preserves retryable rate-limit classification", async () => {
  await assert.rejects(
    () =>
      createOpenAIMenuTranslationProvider(
        "test",
        transport([], "incomplete"),
      ).translate(fields, {}),
    { code: "incomplete_output" },
  );
  await assert.rejects(
    () =>
      createOpenAIMenuTranslationProvider(
        "test",
        (async () => new Response("", { status: 429 })) as typeof fetch,
      ).translate(fields, {}),
    { code: "rate_limit" },
  );
});

for (const code of [
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
  "insufficient_quota",
])
  test(`provider treats ${code} as terminal and never exposes provider messages`, async () => {
    await assert.rejects(
      () =>
        createOpenAIMenuTranslationProvider("test", (async () =>
          Response.json(
            {
              error: {
                code,
                message: "sensitive provider detail",
                type: "insufficient_quota",
              },
            },
            { status: 429 },
          )) as typeof fetch).translate(fields, {}),
      { code: `provider_${code}`, message: `provider_${code}` },
    );
  });

test("provider handles quota type fallback and discards unknown error details", async () => {
  for (const [error, expected] of [
    [
      { code: "unknown-sensitive-detail", type: "insufficient_quota" },
      "provider_insufficient_quota",
    ],
    [{ code: "unknown-sensitive-detail", message: "private" }, "rate_limit"],
    [null, "rate_limit"],
  ] as const) {
    await assert.rejects(
      () =>
        createOpenAIMenuTranslationProvider("test", (async () =>
          Response.json({ error }, { status: 429 })) as typeof fetch).translate(
          fields,
          {},
        ),
      { code: expected, message: expected },
    );
  }
});
