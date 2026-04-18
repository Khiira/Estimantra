-- ============================================================
-- Estimantra - Función SECURITY DEFINER para ver miembros de org
-- Evita la recursividad en políticas RLS de organization_members
-- ============================================================

-- Esta función corre como el dueño de la función (sin RLS),
-- por lo que puede leer organization_members sin causar recursión infinita.
CREATE OR REPLACE FUNCTION auth_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id FROM organization_members WHERE user_id = auth.uid()
$$;

-- Con la función existente, podemos actualizar la política de organization_members
-- a una que permita ver TODOS los miembros de la org sin recursión:
DROP POLICY IF EXISTS org_mem_select ON organization_members;

CREATE POLICY org_mem_select ON organization_members
  FOR SELECT USING (
    org_id IN (SELECT auth_user_org_ids())
  );
