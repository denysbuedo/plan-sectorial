CREATE TABLE `students` (
	`document` text PRIMARY KEY NOT NULL,
	`doc_type` integer NOT NULL,
	`fullname` text NOT NULL,
	`entity` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`is_holder` integer DEFAULT false,
	`is_client` integer DEFAULT false,
	`has_mobile_subscriptions_active` integer DEFAULT false,
	`is_channel_confirmed` integer DEFAULT false,
	`is_channel_configured` integer DEFAULT false,
	`is_configured` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`entity`) REFERENCES `universities`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `universities` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL
);
