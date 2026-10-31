-- ============================================================
-- Migration: PIX e currículo no cadastro do professor (out/2026)
--
-- 100% ADITIVA: só adiciona colunas (todas opcionais).
--
-- ANTES DE RODAR: faça um backup do banco.
-- Rode UMA vez no phpMyAdmin (aba SQL) do banco u677463664_qcdb
-- e também no banco local, se usar.
-- ============================================================

ALTER TABLE users
  ADD COLUMN pix_tipo             VARCHAR(20)  NULL AFTER disponibilidade,
  ADD COLUMN pix_chave            VARCHAR(150) NULL AFTER pix_tipo,
  ADD COLUMN curriculo_nome       VARCHAR(255) NULL AFTER pix_chave,
  ADD COLUMN curriculo_arquivo    VARCHAR(255) NULL AFTER curriculo_nome,
  ADD COLUMN curriculo_mime       VARCHAR(100) NULL AFTER curriculo_arquivo,
  ADD COLUMN curriculo_tamanho    INT UNSIGNED NULL AFTER curriculo_mime,
  ADD COLUMN curriculo_enviado_em DATETIME(3)  NULL AFTER curriculo_tamanho;
