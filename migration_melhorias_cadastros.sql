-- ============================================================
-- Migration: melhorias de cadastros, agendamento e financeiro
-- (out/2026)
--
-- 100% ADITIVA: só adiciona colunas, um valor novo de status e
-- uma tabela nova. Nenhum dado existente é apagado ou alterado.
--
-- ANTES DE RODAR: faça um backup do banco
--   (exportar-banco.bat no local, ou phpMyAdmin → Exportar).
-- Rode UMA vez, no phpMyAdmin (aba SQL) do banco u677463664_qcdb
-- e também no banco local, se usar.
-- ============================================================

-- 1. Novos campos de cadastro (professor) na tabela users
--    Alunos já usam preco_presencial / preco_virtual (valor por aula)
--    e created_at (data de cadastro, preenchida automaticamente).
ALTER TABLE users
  ADD COLUMN telefone2          VARCHAR(20)  NULL AFTER phone,
  ADD COLUMN escola_atuacao     VARCHAR(200) NULL AFTER observacoes,
  ADD COLUMN series_atendidas   JSON         NULL AFTER escola_atuacao,
  ADD COLUMN atende_presencial  TINYINT(1)   NOT NULL DEFAULT 0 AFTER series_atendidas,
  ADD COLUMN atende_online      TINYINT(1)   NOT NULL DEFAULT 0 AFTER atende_presencial,
  ADD COLUMN disponibilidade    JSON         NULL AFTER atende_online;

-- 2. Novo status "PENDENTE" no agendamento
--    (os valores antigos continuam válidos; nenhuma linha muda)
ALTER TABLE appointments
  MODIFY COLUMN status ENUM('PENDENTE','AGENDADO','CANCELADO','CONCLUIDO')
  NOT NULL DEFAULT 'AGENDADO';

-- 3. Ajustes (crédito/débito) na conta do professor
CREATE TABLE ajustes_professor (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  professor_id   BIGINT UNSIGNED NOT NULL,
  tipo           ENUM('CREDITO','DEBITO') NOT NULL,
  valor          DECIMAL(10,2) NOT NULL,
  descricao      VARCHAR(255) NOT NULL,
  pagamento_id   BIGINT UNSIGNED NULL,
  registrado_por BIGINT UNSIGNED NOT NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  INDEX idx_ajustes_professor   (professor_id),
  INDEX idx_ajustes_pagamento   (pagamento_id),
  INDEX idx_ajustes_registrador (registrado_por),
  CONSTRAINT fk_ajustes_professor   FOREIGN KEY (professor_id)   REFERENCES users(id),
  CONSTRAINT fk_ajustes_pagamento   FOREIGN KEY (pagamento_id)   REFERENCES pagamentos_professor(id),
  CONSTRAINT fk_ajustes_registrador FOREIGN KEY (registrado_por) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Conferência (opcional): as contagens devem ser as mesmas de antes
-- SELECT role, COUNT(*) FROM users GROUP BY role;
-- SELECT status, COUNT(*) FROM appointments GROUP BY status;
-- SELECT COUNT(*) FROM transacoes_aluno;
