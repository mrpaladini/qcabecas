-- ============================================================
-- Migration: professor envia material de estudo para o aluno
-- (out/2026)
--
-- 100% ADITIVA: só adiciona colunas. Os materiais já existentes
-- ficam marcados como enviados pelo aluno (origem = 'ALUNO').
--
-- ANTES DE RODAR: faça um backup do banco.
-- Rode UMA vez no phpMyAdmin (aba SQL) do banco u677463664_qcdb
-- e também no banco local, se usar.
-- ============================================================

ALTER TABLE materials
  ADD COLUMN origem       VARCHAR(20)     NOT NULL DEFAULT 'ALUNO' AFTER size_bytes,
  ADD COLUMN enviado_por  BIGINT UNSIGNED NULL AFTER origem,
  ADD INDEX idx_materials_aluno_origem (aluno_id, origem);

-- Preenche quem enviou nos materiais antigos (todos vieram de alunos)
UPDATE materials SET enviado_por = aluno_id WHERE enviado_por IS NULL;
