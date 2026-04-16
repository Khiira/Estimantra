CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede consultar un token (para que los no autenticados o recien creados puedan ver a que org pertenece)
CREATE POLICY "invites_select" ON organization_invitations FOR SELECT USING (true);

-- Solo los miembros de la organizacion pueden crearlas o marcarlas validas/invalidas
CREATE POLICY "invites_all" ON organization_invitations FOR ALL USING (
  org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
);
