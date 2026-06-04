-- ============================================================
-- Portal Quebra Cabeças 10 Anos — Setup do Banco de Dados
-- ============================================================
-- Compatível com: MySQL 8.0+
-- Charset: utf8mb4 (suporte a emojis e caracteres especiais PT-BR)
-- Collation: utf8mb4_unicode_ci
-- Engine: InnoDB (suporte a FK, transações ACID)
--
-- Execução:
--   mysql -u root -p < setup.sql
--
-- ATENÇÃO: Este script é IDEMPOTENTE (IF NOT EXISTS / INSERT IGNORE).
--          Pode ser reexecutado com segurança em ambiente de desenvolvimento.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Criação do banco de dados
-- ------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `qcabecas`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `qcabecas`;

-- Garante que todas as operações usem o charset correto na sessão
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET character_set_client = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results = utf8mb4;

-- ------------------------------------------------------------
-- 2. Tabela: users
-- Armazena todos os perfis de acesso ao portal.
-- LGPD: email, name e phone são dados pessoais de identificação.
--       Base legal: execução de contrato (art. 7º, V, LGPD).
--       Alunos podem ser menores de idade — tratamento especial.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT
                    COMMENT 'Chave primária auto-incremental',

    `email`         VARCHAR(255)        NOT NULL
                    COMMENT 'LGPD: dado pessoal — e-mail de acesso; base legal: execução de contrato (art. 7º, V)',

    `password_hash` VARCHAR(255)        NOT NULL
                    COMMENT 'Hash bcrypt da senha — NUNCA armazenar senha em texto puro',

    `name`          VARCHAR(150)        NOT NULL
                    COMMENT 'LGPD: dado pessoal — nome completo do usuário; base legal: execução de contrato (art. 7º, V)',

    `role`          ENUM('ALUNO','PROFESSOR','COORDENADOR') NOT NULL DEFAULT 'ALUNO'
                    COMMENT 'Perfil de acesso: ALUNO=visualiza aulas e envia materiais; PROFESSOR=visualiza agenda; COORDENADOR=agenda aulas e gerencia tudo',

    `phone`         VARCHAR(20)         NULL DEFAULT NULL
                    COMMENT 'LGPD: dado pessoal — telefone de contato; base legal: execução de contrato (art. 7º, V). Alunos menores: telefone do responsável',

    -- Campos LGPD art. 14 — obrigatórios para tratamento de dados de menores de idade
    `data_nascimento`       DATE            NULL DEFAULT NULL
                            COMMENT 'LGPD art. 14: necessário para identificar menores e acionar consentimento parental. Alunos com menos de 18 anos exigem autorização do responsável',

    `responsavel_nome`      VARCHAR(150)    NULL DEFAULT NULL
                            COMMENT 'LGPD art. 14, §1º: nome do responsável legal — obrigatório para alunos menores de idade',

    `responsavel_email`     VARCHAR(255)    NULL DEFAULT NULL
                            COMMENT 'LGPD art. 14, §1º: e-mail do responsável para confirmação de consentimento',

    `responsavel_telefone`  VARCHAR(20)     NULL DEFAULT NULL
                            COMMENT 'LGPD art. 14, §1º: telefone do responsável legal',

    `consentimento_lgpd`    TINYINT(1)      NOT NULL DEFAULT 0
                            COMMENT 'LGPD art. 7º/14: 0=não consentiu, 1=consentiu. Para menores, consentimento deve ser do responsável legal',

    `consentimento_data`    DATETIME(3)     NULL DEFAULT NULL
                            COMMENT 'Data/hora em que o consentimento LGPD foi registrado',

    `created_at`    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                    COMMENT 'Data/hora de criação do registro (UTC)',

    `updated_at`    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                        ON UPDATE CURRENT_TIMESTAMP(3)
                    COMMENT 'Data/hora da última atualização (UTC)',

    `deleted_at`    DATETIME(3)         NULL DEFAULT NULL
                    COMMENT 'Soft delete: NULL=ativo; preenchido=inativo. LGPD: anonimizar dados pessoais ao invés de deletar fisicamente',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_deleted_at` (`deleted_at`),
    INDEX `idx_users_role_deleted_at` (`role`, `deleted_at`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Usuários do portal: alunos, professores e coordenadores. LGPD: contém dados pessoais — ver campo a campo.';


-- ------------------------------------------------------------
-- 3. Tabela: appointments
-- Agendamentos de aulas realizados exclusivamente por coordenadores.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `appointments` (
    `id`                BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT
                        COMMENT 'Chave primária auto-incremental',

    `coordenador_id`    BIGINT UNSIGNED     NOT NULL
                        COMMENT 'FK para users: coordenador que criou o agendamento',

    `aluno_id`          BIGINT UNSIGNED     NOT NULL
                        COMMENT 'FK para users: aluno que participará da aula',

    `professor_id`      BIGINT UNSIGNED     NOT NULL
                        COMMENT 'FK para users: professor que ministrará a aula',

    `disciplina`        VARCHAR(150)        NOT NULL
                        COMMENT 'Disciplina ou matéria da aula (ex: Matemática, Português)',

    `data_hora`         DATETIME(3)         NOT NULL
                        COMMENT 'Data e hora de início da aula (armazenado em UTC)',

    `duracao_minutos`   SMALLINT UNSIGNED   NOT NULL DEFAULT 60
                        COMMENT 'Duração da aula em minutos (padrão: 60)',

    `status`            ENUM('AGENDADO','CANCELADO','CONCLUIDO') NOT NULL DEFAULT 'AGENDADO'
                        COMMENT 'Estado do agendamento: AGENDADO=confirmado; CANCELADO=não ocorrerá; CONCLUIDO=realizado',

    `observacoes`       TEXT                NULL DEFAULT NULL
                        COMMENT 'Observações livres do coordenador sobre a aula',

    `created_at`        DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora de criação do agendamento (UTC)',

    `updated_at`        DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                            ON UPDATE CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora da última atualização (UTC)',

    `cancelled_at`      DATETIME(3)         NULL DEFAULT NULL
                        COMMENT 'Data/hora do cancelamento — NULL se não cancelado. Complementa o status CANCELADO com timestamp preciso',

    PRIMARY KEY (`id`),

    -- Índices de foreign key (obrigatórios para integridade e performance JOIN)
    INDEX `idx_appointments_coordenador_id` (`coordenador_id`),
    INDEX `idx_appointments_aluno_id` (`aluno_id`),
    INDEX `idx_appointments_professor_id` (`professor_id`),

    -- Índices compostos para consultas frequentes na agenda
    INDEX `idx_appointments_aluno_data` (`aluno_id`, `data_hora`),
    INDEX `idx_appointments_professor_data` (`professor_id`, `data_hora`),
    INDEX `idx_appointments_status` (`status`),
    INDEX `idx_appointments_data_hora` (`data_hora`),

    -- Constraints de integridade referencial
    CONSTRAINT `fk_appointments_coordenador`
        FOREIGN KEY (`coordenador_id`) REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_appointments_aluno`
        FOREIGN KEY (`aluno_id`) REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_appointments_professor`
        FOREIGN KEY (`professor_id`) REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Agendamentos de aulas. Apenas coordenadores podem criar/editar. Soft cancel via cancelled_at + status CANCELADO.';


-- ------------------------------------------------------------
-- 4. Tabela: materials
-- Arquivos enviados por alunos associados a um agendamento.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `materials` (
    `id`                BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT
                        COMMENT 'Chave primária auto-incremental',

    `appointment_id`    BIGINT UNSIGNED     NOT NULL
                        COMMENT 'FK para appointments: aula à qual o material pertence',

    `aluno_id`          BIGINT UNSIGNED     NOT NULL
                        COMMENT 'FK para users: aluno que enviou o material (redundante para facilitar queries)',

    `original_name`     VARCHAR(255)        NOT NULL
                        COMMENT 'LGPD: nome original do arquivo como enviado pelo aluno — exibido apenas para aluno e professor da aula',

    `stored_name`       VARCHAR(255)        NOT NULL
                        COMMENT 'Nome do arquivo no sistema de arquivos (UUIDv4 + extensão) — não expõe o nome original',

    `filepath`          VARCHAR(500)        NOT NULL
                        COMMENT 'Caminho relativo ao UPLOAD_DIR no servidor (ex: 2024/01/uuid.pdf)',

    `mimetype`          VARCHAR(100)        NOT NULL
                        COMMENT 'MIME type validado no upload (ex: application/pdf, image/jpeg)',

    `size_bytes`        INT UNSIGNED        NOT NULL
                        COMMENT 'Tamanho do arquivo em bytes — usado para validação e exibição',

    `created_at`        DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora do upload (UTC)',

    `updated_at`        DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                            ON UPDATE CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora da última atualização (UTC)',

    PRIMARY KEY (`id`),

    -- Índices de foreign key
    INDEX `idx_materials_appointment_id` (`appointment_id`),
    INDEX `idx_materials_aluno_id` (`aluno_id`),

    -- Índice composto para listar materiais de uma aula
    INDEX `idx_materials_appointment_aluno` (`appointment_id`, `aluno_id`),

    -- Constraints de integridade referencial
    CONSTRAINT `fk_materials_appointment`
        FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_materials_aluno`
        FOREIGN KEY (`aluno_id`) REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Materiais (arquivos) enviados por alunos para suas aulas agendadas. Arquivos armazenados com nome randomizado no servidor.';


-- ------------------------------------------------------------
-- 5. Tabela: email_logs
-- Registro de todos os e-mails transacionais enviados via Resend.
-- Permite auditoria, diagnóstico de falhas e reenvio manual.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `email_logs` (
    `id`                BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT
                        COMMENT 'Chave primária auto-incremental',

    `appointment_id`    BIGINT UNSIGNED     NOT NULL
                        COMMENT 'FK para appointments: agendamento relacionado ao e-mail',

    `recipient_email`   VARCHAR(255)        NOT NULL
                        COMMENT 'LGPD: e-mail do destinatário — dado pessoal; base legal: execução de contrato (art. 7º, V)',

    `type`              ENUM('CONFIRMACAO','CANCELAMENTO','LEMBRETE') NOT NULL
                        COMMENT 'Tipo do e-mail: CONFIRMACAO=após agendamento; CANCELAMENTO=após cancelar; LEMBRETE=antes da aula',

    `sent_at`           DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora do disparo do e-mail (UTC)',

    `status`            ENUM('ENVIADO','ERRO') NOT NULL DEFAULT 'ENVIADO'
                        COMMENT 'Resultado do envio: ENVIADO=API Resend retornou sucesso; ERRO=falha no envio',

    `error_message`     TEXT                NULL DEFAULT NULL
                        COMMENT 'Mensagem de erro da API Resend — preenchida apenas quando status=ERRO',

    `created_at`        DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora de criação do registro (UTC)',

    `updated_at`        DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                            ON UPDATE CURRENT_TIMESTAMP(3)
                        COMMENT 'Data/hora da última atualização (UTC)',

    PRIMARY KEY (`id`),

    -- Índice de foreign key
    INDEX `idx_email_logs_appointment_id` (`appointment_id`),

    -- Índices de consulta frequente
    INDEX `idx_email_logs_status` (`status`),
    INDEX `idx_email_logs_type` (`type`),
    INDEX `idx_email_logs_sent_at` (`sent_at`),
    INDEX `idx_email_logs_appointment_type` (`appointment_id`, `type`),

    -- Constraint de integridade referencial
    CONSTRAINT `fk_email_logs_appointment`
        FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Log de todos os e-mails transacionais enviados. Permite auditoria e diagnóstico de falhas de envio.';


-- ============================================================
-- 6. SEED — Dados iniciais
-- ============================================================

-- ------------------------------------------------------------
-- 6.1 Coordenador inicial do sistema
-- ============================================================
-- ATENÇÃO DE SEGURANÇA:
--   A senha abaixo é apenas um EXEMPLO de hash bcrypt (12 rounds).
--   A senha original deste hash é: "MudarEstaSenh@123"
--   VOCÊ DEVE TROCAR ESSA SENHA imediatamente após o primeiro login.
--   Gere um novo hash com: node -e "const b=require('bcryptjs'); b.hash('SuaNovaSenha',12).then(console.log)"
-- ============================================================
INSERT IGNORE INTO `users`
    (`email`, `password_hash`, `name`, `role`, `phone`, `created_at`, `updated_at`)
VALUES
    (
        'coordenacao@quebracabecas.com.br',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMYJqC1VmXSWZ7xBvK3Uw5yHMi',  -- TROCAR ANTES DE IR PARA PRODUÇÃO
        'Coordenação Quebra Cabeças',
        'COORDENADOR',
        '(19) 99999-9999',
        NOW(3),
        NOW(3)
    );

-- ------------------------------------------------------------
-- 6.2 Verificação pós-setup (executa como comentário informativo)
-- Para verificar o resultado, execute manualmente:
--
--   SELECT id, email, role, created_at FROM users;
--   SHOW INDEX FROM users;
--   SHOW INDEX FROM appointments;
--   SHOW INDEX FROM materials;
--   SHOW INDEX FROM email_logs;
-- ------------------------------------------------------------

-- ============================================================
-- FIM DO SCRIPT DE SETUP
-- ============================================================
-- Próximos passos:
--   1. Criar usuário MySQL dedicado:
--      CREATE USER 'qcabecas_user'@'localhost' IDENTIFIED BY 'SenhaSegura';
--      GRANT SELECT, INSERT, UPDATE, DELETE ON qcabecas.* TO 'qcabecas_user'@'localhost';
--      FLUSH PRIVILEGES;
--   2. Atualizar DATABASE_URL no .env.local
--   3. Executar: npx prisma db pull  (ou usar schema.prisma diretamente)
--   4. Trocar a senha do coordenador inicial via interface admin
-- ============================================================
