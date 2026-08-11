import test from "node:test";
import assert from "node:assert/strict";
import type { ModifierGroup } from "./types";
import {
  areModifierSelectionsValid,
  getModifierGroupMinimum,
  getModifierGroupSelectionCount,
  isModifierGroupSelectionValid,
} from "./modifierSelectionValidation";

const requiredSingle: ModifierGroup = {
  id: "size",
  name: "Boyut",
  selection_mode: "single",
  required: true,
  min: 0,
  max: 1,
  options: [
    {
      id: "small",
      name: "Küçük",
      price_delta: 0,
      calorie_delta: 0,
      is_default: false,
      allergen_codes: [],
    },
    {
      id: "large",
      name: "Büyük",
      price_delta: 20,
      calorie_delta: 0,
      is_default: false,
      allergen_codes: [],
    },
  ],
};

test("treats required groups as requiring one selection even when min is zero", () => {
  assert.equal(getModifierGroupMinimum(requiredSingle), 1);
  assert.equal(isModifierGroupSelectionValid(requiredSingle, []), false);
  assert.equal(
    isModifierGroupSelectionValid(requiredSingle, [
      { group_id: "size", option_id: "small" },
    ]),
    true,
  );
});

test("counts quantity selections and enforces the group maximum", () => {
  const quantityGroup: ModifierGroup = {
    ...requiredSingle,
    id: "extras",
    selection_mode: "quantity",
    required: false,
    min: 0,
    max: 3,
    options: [{ ...requiredSingle.options[0]!, id: "sauce" }],
  };
  const selections = [{ group_id: "extras", option_id: "sauce", quantity: 3 }];
  assert.equal(getModifierGroupSelectionCount(quantityGroup, selections), 3);
  assert.equal(isModifierGroupSelectionValid(quantityGroup, selections), true);
  assert.equal(
    isModifierGroupSelectionValid(quantityGroup, [
      { group_id: "extras", option_id: "sauce", quantity: 4 },
    ]),
    false,
  );
});

test("rejects unknown groups, unknown options and duplicate selections", () => {
  assert.equal(
    areModifierSelectionsValid([requiredSingle], [
      { group_id: "unknown", option_id: "small" },
    ]),
    false,
  );
  assert.equal(
    areModifierSelectionsValid([requiredSingle], [
      { group_id: "size", option_id: "unknown" },
    ]),
    false,
  );
  assert.equal(
    areModifierSelectionsValid([requiredSingle], [
      { group_id: "size", option_id: "small" },
      { group_id: "size", option_id: "small" },
    ]),
    false,
  );
});
