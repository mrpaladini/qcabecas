-- ============================================================
-- Migration: corrige tamanho da coluna temp_password
-- O valor criptografado (AES-256-GCM, base64) ocupa ~48 chars.
-- VarChar(20) anterior causava erro de truncamento ao cadastrar.
-- ============================================================
ALTER TABLE users
  MODIFY COLUMN temp_password VARCHAR(100) NULL;
