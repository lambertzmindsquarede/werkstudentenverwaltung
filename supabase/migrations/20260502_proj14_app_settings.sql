-- PROJ-14: Bearbeitungsfrist für Zeiterfassung
-- Schlüssel-Wert-Tabelle für globale App-Einstellungen
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Nutzer dürfen lesen (Werkstudenten brauchen den Wert für den clientseitigen Guard)
CREATE POLICY "authenticated_read_app_settings"
  ON app_settings FOR SELECT TO authenticated USING (true);

-- Nur Manager dürfen einfügen
CREATE POLICY "manager_insert_app_settings"
  ON app_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Nur Manager dürfen aktualisieren
CREATE POLICY "manager_update_app_settings"
  ON app_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Standardwert: 14 Tage (kein Fehler bei wiederholter Ausführung)
INSERT INTO app_settings (key, value)
VALUES ('max_edit_days_past', '14')
ON CONFLICT (key) DO NOTHING;
