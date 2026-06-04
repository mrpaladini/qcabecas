-- ============================================================
-- Migration: tabelas financeiras (contas_aluno, transacoes_aluno)
-- ============================================================

CREATE TABLE contas_aluno (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  aluno_id   BIGINT UNSIGNED NOT NULL,
  saldo      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_contas_aluno_aluno (aluno_id),
  CONSTRAINT fk_contas_aluno_user FOREIGN KEY (aluno_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transacoes_aluno (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conta_id       INT UNSIGNED NOT NULL,
  tipo           ENUM('CREDITO','DEBITO') NOT NULL,
  valor          DECIMAL(10,2) NOT NULL,
  descricao      VARCHAR(255) NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  registrado_por BIGINT UNSIGNED NOT NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_transacoes_appointment (appointment_id),
  INDEX idx_transacoes_conta (conta_id),
  INDEX idx_transacoes_created_at (created_at),
  CONSTRAINT fk_transacoes_conta    FOREIGN KEY (conta_id)       REFERENCES contas_aluno(id),
  CONSTRAINT fk_transacoes_apt      FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_transacoes_registrador FOREIGN KEY (registrado_por) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
