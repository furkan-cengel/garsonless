-- Add sub-category support to menu_categories
ALTER TABLE menu_categories
  ADD COLUMN parent_id uuid REFERENCES menu_categories(id) ON DELETE CASCADE;

CREATE INDEX idx_menu_categories_parent_id
  ON menu_categories(parent_id)
  WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
