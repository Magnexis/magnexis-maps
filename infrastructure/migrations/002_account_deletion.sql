-- Retain moderation events without requiring a deleted account to remain.
-- User deletion explicitly clears attribution and private notes in one transaction.
ALTER TABLE moderation_actions ALTER COLUMN moderator_id DROP NOT NULL;
