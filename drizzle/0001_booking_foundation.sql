CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_created` ON `audit_events` (`created`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `hourly_price` integer;--> statement-breakpoint
CREATE INDEX `bookings_capacity` ON `bookings` (`lot_id`,`status`,`start`,`end`);--> statement-breakpoint
CREATE INDEX `bookings_user` ON `bookings` (`user_id`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_request_key` ON `bookings` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `lots_owner` ON `lots` (`owner`);--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);