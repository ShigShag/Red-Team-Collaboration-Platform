ALTER TYPE security_event_type ADD VALUE 'session_hijack_detected';
--> statement-breakpoint
ALTER TYPE notification_type ADD VALUE 'security_session_hijack';
