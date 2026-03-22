-- Add note_id FK so notifications for notes/quotes can link to content
ALTER TABLE notifications ADD COLUMN note_id UUID REFERENCES notes(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_note ON notifications(note_id) WHERE note_id IS NOT NULL;
