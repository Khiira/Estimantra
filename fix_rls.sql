-- 1. Función de seguridad (SECURITY DEFINER permite saltar el RLS)
CREATE OR REPLACE FUNCTION public.is_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE org_id = target_org_id AND user_id = auth.uid()
  );
$$;

-- 2. Limpiar políticas viejas
DROP POLICY IF EXISTS org_mem_select ON public.organization_members;
DROP POLICY IF EXISTS org_select ON public.organizations;

-- 3. Aplicar nuevas políticas usando la función (SIN RECURSIVIDAD)
CREATE POLICY org_mem_select ON public.organization_members FOR SELECT TO public 
USING (is_member(org_id));

CREATE POLICY org_select ON public.organizations FOR SELECT TO public 
USING (is_member(id) OR join_code IS NOT NULL);
