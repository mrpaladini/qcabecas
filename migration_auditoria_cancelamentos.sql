-- ============================================================
-- Migration: Auditoria + correção financeira de aulas canceladas
-- (out/2026)
--
-- ANTES DE RODAR: faça um backup do banco
--   (exportar-banco.bat no local, ou phpMyAdmin → Exportar).
-- Rode UMA vez, no phpMyAdmin (aba SQL) do banco u677463664_qcdb
-- e também no banco local, se usar.
--
-- Parte 1 é aditiva (tabela nova).
-- Parte 2 CORRIGE dados: estorna cobranças de aulas que estão
-- canceladas. Rode primeiro as consultas de conferência (2.0) para
-- ver o que será alterado.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE 1 — Tabela de auditoria (menu Administrativo > Auditoria)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,
  user_nome    VARCHAR(150)    NOT NULL,
  user_role    VARCHAR(20)     NULL,
  acao         VARCHAR(60)     NOT NULL,
  entidade     VARCHAR(40)     NOT NULL,
  entidade_id  VARCHAR(40)     NULL,
  descricao    TEXT            NOT NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_created  (created_at),
  INDEX idx_audit_user     (user_id),
  INDEX idx_audit_acao     (acao),
  INDEX idx_audit_entidade (entidade),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- PARTE 2 — Aulas canceladas não geram cobrança nem pagamento
--
-- Antes desta versão, uma aula marcada como CONCLUÍDA e depois
-- alterada para CANCELADA continuava com o débito na conta do aluno.
-- ------------------------------------------------------------

-- 2.0 CONFERÊNCIA (só leitura) ----------------------------------

-- a) Cobranças de alunos ligadas a aulas canceladas (serão estornadas)
SELECT t.id AS transacao_id, u.name AS aluno, a.disciplina, a.data_hora, t.valor
FROM transacoes_aluno t
JOIN appointments a ON a.id = t.appointment_id
JOIN users u        ON u.id = a.aluno_id
WHERE a.status = 'CANCELADO' AND t.tipo = 'DEBITO';

-- b) Aulas canceladas que AINDA NÃO foram pagas ao professor mas têm valor
--    (serão zeradas)
SELECT e.id AS evidencia_id, e.professor_nome, e.aluno_nome, e.disciplina, e.data_aula, e.valor_professor, e.status
FROM evidencias e
JOIN appointments a ON a.id = e.appointment_id
WHERE a.status = 'CANCELADO' AND e.pago_professor = 0
  AND (e.valor_professor <> 0 OR e.valor_aluno <> 0 OR e.status <> 'CANCELADO');

-- c) Aulas canceladas que JÁ FORAM PAGAS ao professor
--    (NÃO são alteradas automaticamente — veja o passo 2.3 opcional)
SELECT e.id AS evidencia_id, e.professor_nome, e.aluno_nome, e.disciplina, e.data_aula,
       e.valor_professor, e.pagamento_id
FROM evidencias e
JOIN appointments a ON a.id = e.appointment_id
WHERE a.status = 'CANCELADO' AND e.pago_professor = 1;


-- 2.1 Estorna a cobrança do aluno (devolve o saldo e apaga o débito) ----
UPDATE contas_aluno c
JOIN (
  SELECT t.conta_id, SUM(t.valor) AS total
  FROM transacoes_aluno t
  JOIN appointments a ON a.id = t.appointment_id
  WHERE a.status = 'CANCELADO' AND t.tipo = 'DEBITO'
  GROUP BY t.conta_id
) x ON x.conta_id = c.id
SET c.saldo = c.saldo + x.total;

DELETE t FROM transacoes_aluno t
JOIN appointments a ON a.id = t.appointment_id
WHERE a.status = 'CANCELADO' AND t.tipo = 'DEBITO';


-- 2.2 Tira de Contas a Pagar as aulas canceladas ainda não pagas --------
UPDATE evidencias e
JOIN appointments a ON a.id = e.appointment_id
SET e.status = 'CANCELADO', e.valor_professor = 0, e.valor_aluno = 0
WHERE a.status = 'CANCELADO' AND e.pago_professor = 0;


-- 2.3 (OPCIONAL) Aulas canceladas que já foram pagas ao professor -------
-- Lança um DÉBITO de ajuste para descontar no próximo pagamento.
-- Só rode se a consulta (c) acima mostrou linhas e você quiser descontar,
-- e rode UMA ÚNICA VEZ (rodar de novo duplicaria o desconto).
-- Para rodar, apague os "-- " do início das 9 linhas abaixo.
--
-- INSERT INTO ajustes_professor (professor_id, tipo, valor, descricao, registrado_por, created_at)
-- SELECT a.professor_id, 'DEBITO', e.valor_professor,
--        CONCAT('Estorno: aula de ', e.disciplina, ' (', e.aluno_nome, ') em ',
--               DATE_FORMAT(e.data_aula, '%d/%m/%Y'), ' cancelada após pagamento'),
--        a.coordenador_id, NOW(3)
-- FROM evidencias e
-- JOIN appointments a ON a.id = e.appointment_id
-- WHERE a.status = 'CANCELADO' AND e.pago_professor = 1 AND e.valor_professor > 0;
-- UPDATE evidencias e JOIN appointments a ON a.id = e.appointment_id SET e.status = 'CANCELADO' WHERE a.status = 'CANCELADO' AND e.pago_professor = 1;
