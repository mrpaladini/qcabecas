-- Adiciona campo horarios_disponiveis na tabela rooms
-- Execute este script no banco de dados MySQL antes de usar os horários disponíveis nas salas.

ALTER TABLE rooms
  ADD COLUMN horarios_disponiveis JSON NULL AFTER active;
