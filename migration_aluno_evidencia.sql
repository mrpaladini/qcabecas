-- ============================================================
-- Migration: campos do aluno + valorCobrado + tabela evidencias
-- Execute no banco MySQL antes de subir a aplicação.
-- ============================================================

-- 1. Novos campos na tabela users (dados do aluno)
ALTER TABLE users
  ADD COLUMN cpf_responsavel      VARCHAR(14)  NULL AFTER responsavel_nome,
  ADD COLUMN rua                  VARCHAR(255) NULL AFTER consentimento_data,
  ADD COLUMN bairro               VARCHAR(100) NULL AFTER rua,
  ADD COLUMN cidade               VARCHAR(100) NULL AFTER bairro,
  ADD COLUMN cep                  VARCHAR(9)   NULL AFTER cidade,
  ADD COLUMN referencia_endereco  VARCHAR(255) NULL AFTER cep,
  ADD COLUMN escola               VARCHAR(200) NULL AFTER referencia_endereco,
  ADD COLUMN serie                VARCHAR(50)  NULL AFTER escola,
  ADD COLUMN observacoes          TEXT         NULL AFTER serie;

-- 2. Campo valor cobrado ao aluno na tabela appointments
ALTER TABLE appointments
  ADD COLUMN valor_cobrado DECIMAL(10,2) NULL AFTER observacoes;

-- 3. Nova tabela de log de evidências
CREATE TABLE evidencias (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id  BIGINT UNSIGNED NOT NULL,
  aluno_nome      VARCHAR(150) NOT NULL,
  professor_nome  VARCHAR(150) NOT NULL,
  data_aula       DATETIME(3)  NOT NULL,
  duracao_minutos SMALLINT     NOT NULL,
  disciplina      VARCHAR(150) NOT NULL,
  sala_tipo       VARCHAR(20)  NULL,
  valor_professor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_aluno     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status          VARCHAR(20)  NOT NULL,
  registrado_em   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_evidencias_appointment (appointment_id),
  INDEX idx_evidencias_status (status),
  INDEX idx_evidencias_registrado_em (registrado_em),

  CONSTRAINT fk_evidencias_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
