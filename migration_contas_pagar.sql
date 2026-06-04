-- ============================================================
-- Migration: Contas a Pagar (pagamentos para professores)
-- ============================================================

-- 1. Nova tabela de lotes de pagamento para professores
CREATE TABLE IF NOT EXISTS pagamentos_professor (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  professor_id    BIGINT UNSIGNED NOT NULL,
  professor_nome  VARCHAR(150) NOT NULL,
  total_valor     DECIMAL(10,2) NOT NULL DEFAULT 0,
  aula_count      SMALLINT NOT NULL DEFAULT 0,
  periodo_inicio  DATETIME(3) NULL,
  periodo_fim     DATETIME(3) NULL,
  observacoes     TEXT NULL,
  gerado_em       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  gerado_por      BIGINT UNSIGNED NOT NULL,
  INDEX idx_pag_prof_professor_id (professor_id),
  INDEX idx_pag_prof_gerado_em (gerado_em),
  CONSTRAINT fk_pag_prof_professor FOREIGN KEY (professor_id) REFERENCES users(id),
  CONSTRAINT fk_pag_prof_gerado_por FOREIGN KEY (gerado_por) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Adiciona campos de controle de pagamento na tabela evidencias
ALTER TABLE evidencias
  ADD COLUMN pago_professor TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN pagamento_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_evidencias_pago_professor (pago_professor),
  ADD INDEX idx_evidencias_pagamento_id (pagamento_id),
  ADD CONSTRAINT fk_evidencias_pagamento
    FOREIGN KEY (pagamento_id) REFERENCES pagamentos_professor(id)
    ON DELETE SET NULL;
