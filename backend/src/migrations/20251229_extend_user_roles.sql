-- Extend allowed roles in users.role CHECK constraint to support finance, inventory, operations

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('owner','admin','finance','inventory','operations','driver'));


