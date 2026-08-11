import type { ModifierGroup, SelectedModifier } from "./types";

export function getModifierGroupMinimum(group: ModifierGroup): number {
  return Math.max(group.min, group.required ? 1 : 0);
}

export function getModifierGroupSelectionCount(
  group: ModifierGroup,
  selections: SelectedModifier[],
): number {
  return selections
    .filter((selection) => selection.group_id === group.id)
    .reduce(
      (sum, selection) =>
        sum +
        (group.selection_mode === "quantity"
          ? Math.max(1, Math.floor(selection.quantity ?? 1))
          : 1),
      0,
    );
}

export function isModifierGroupSelectionValid(
  group: ModifierGroup,
  selections: SelectedModifier[],
): boolean {
  const selected = selections.filter((selection) => selection.group_id === group.id);
  const optionIds = new Set(group.options.map((option) => option.id));
  const selectedOptionIds = new Set(selected.map((selection) => selection.option_id));

  if (selectedOptionIds.size !== selected.length) return false;
  if (selected.some((selection) => !optionIds.has(selection.option_id))) return false;
  if (
    group.selection_mode === "quantity" &&
    selected.some(
      (selection) =>
        !Number.isInteger(selection.quantity ?? 1) || (selection.quantity ?? 1) < 1,
    )
  ) {
    return false;
  }
  if (group.selection_mode === "single" && selected.length > 1) return false;

  const count = getModifierGroupSelectionCount(group, selected);
  return count >= getModifierGroupMinimum(group) && count <= group.max;
}

export function areModifierSelectionsValid(
  groups: ModifierGroup[],
  selections: SelectedModifier[],
): boolean {
  const groupIds = new Set(groups.map((group) => group.id));
  if (selections.some((selection) => !groupIds.has(selection.group_id))) return false;
  return groups.every((group) => isModifierGroupSelectionValid(group, selections));
}
