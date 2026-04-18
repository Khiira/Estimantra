-- ============================================================
-- Estimantra - Fix RLS en organization_members
-- Permite ver TODOS los miembros de orgs a las que pertenezco
-- ============================================================

-- Eliminar política anterior restrictiva (solo propia fila)
DROP POLICY IF EXISTS "org_mem_select" ON organization_members;

-- Nueva política: permitir ver todos los registros de orgs donde participo
CREATE POLICY "org_mem_select" ON organization_members
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
