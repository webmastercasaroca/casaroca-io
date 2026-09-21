-- =====================================================================
-- Seed 022 — CALENDARIO DE FESTIVOS
--
-- ⛔ Sin esto, `plataforma.dias_habiles_desde` cuenta Navidad y Ano Nuevo
--    como habiles y fija el vencimiento de una peticion de Habeas Data EN
--    UN DIA FESTIVO. El vencimiento que el sistema registra no seria el
--    vencimiento legal, y la evidencia propia del sistema diria una fecha
--    equivocada ante la SIC.
--
-- Colombia: fijos mas los trasladados al lunes por la Ley 51 de 1983.
-- Sembrados 2026 a 2028; la funcion AVISA si se sale del rango.
-- =====================================================================
INSERT INTO sistema.festivos (pais, fecha, nombre)
SELECT 'CO', d::date, n FROM (VALUES
 ('2026-01-01','Ano Nuevo'),('2026-01-12','Reyes'),('2026-03-23','San Jose'),
 ('2026-04-02','Jueves Santo'),('2026-04-03','Viernes Santo'),('2026-05-01','Trabajo'),
 ('2026-05-18','Ascension'),('2026-06-08','Corpus Christi'),('2026-06-15','Sagrado Corazon'),
 ('2026-06-29','San Pedro y San Pablo'),('2026-07-20','Independencia'),('2026-08-07','Boyaca'),
 ('2026-08-17','Asuncion'),('2026-10-12','Dia de la Raza'),('2026-11-02','Todos los Santos'),
 ('2026-11-16','Independencia de Cartagena'),('2026-12-08','Inmaculada'),('2026-12-25','Navidad'),
 ('2027-01-01','Ano Nuevo'),('2027-01-11','Reyes'),('2027-03-22','San Jose'),
 ('2027-03-25','Jueves Santo'),('2027-03-26','Viernes Santo'),('2027-05-01','Trabajo'),
 ('2027-05-10','Ascension'),('2027-05-31','Corpus Christi'),('2027-06-07','Sagrado Corazon'),
 ('2027-07-05','San Pedro y San Pablo'),('2027-07-20','Independencia'),('2027-08-07','Boyaca'),
 ('2027-08-16','Asuncion'),('2027-10-18','Dia de la Raza'),('2027-11-01','Todos los Santos'),
 ('2027-11-15','Independencia de Cartagena'),('2027-12-08','Inmaculada'),('2027-12-25','Navidad'),
 ('2028-01-01','Ano Nuevo'),('2028-01-10','Reyes'),('2028-03-20','San Jose'),
 ('2028-04-13','Jueves Santo'),('2028-04-14','Viernes Santo'),('2028-05-01','Trabajo'),
 ('2028-05-29','Ascension'),('2028-06-19','Corpus Christi'),('2028-06-26','Sagrado Corazon'),
 ('2028-07-03','San Pedro y San Pablo'),('2028-07-20','Independencia'),('2028-08-07','Boyaca'),
 ('2028-08-21','Asuncion'),('2028-10-16','Dia de la Raza'),('2028-11-06','Todos los Santos'),
 ('2028-11-13','Independencia de Cartagena'),('2028-12-08','Inmaculada'),('2028-12-25','Navidad')
) AS v(d,n)
ON CONFLICT DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sistema.festivos;
  RAISE NOTICE 'Festivos sembrados: %', n;
END $$;
