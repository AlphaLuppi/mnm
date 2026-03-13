CREATE TABLE `workflow_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);
