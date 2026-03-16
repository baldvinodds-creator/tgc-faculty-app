-- CreateTable
CREATE TABLE "faculty" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "status" TEXT NOT NULL,
    "full_name" TEXT,
    "public_name" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "teaching_languages" TEXT[],
    "short_bio" TEXT,
    "long_bio" TEXT,
    "credentials" TEXT,
    "institutions" TEXT,
    "awards" TEXT,
    "specialties" TEXT[],
    "primary_instrument" TEXT,
    "division" TEXT,
    "years_experience" INTEGER,
    "headshot_url" TEXT,
    "website_url" TEXT,
    "social_instagram" TEXT,
    "social_youtube" TEXT,
    "social_linkedin" TEXT,
    "social_twitter" TEXT,
    "social_other" TEXT,
    "intro_video_url" TEXT,
    "zoom_link" TEXT,
    "accepting_students" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "profile_completeness" INTEGER NOT NULL DEFAULT 0,
    "profile_published" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_application" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "application_data" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_edits" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "review_notes" TEXT,

    CONSTRAINT "profile_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "offering_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "topic" TEXT,
    "level" TEXT,
    "age_groups" TEXT[],
    "format" TEXT,
    "duration_minutes" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capacity" INTEGER,
    "accepting_students" BOOLEAN NOT NULL DEFAULT true,
    "prerequisites" TEXT,
    "recording_allowed" BOOLEAN,
    "replay_allowed" BOOLEAN,
    "materials_required" TEXT,
    "one_time" BOOLEAN NOT NULL DEFAULT false,
    "recurring_rule" TEXT,
    "proposed_start_date" TIMESTAMP(3),
    "proposed_end_date" TIMESTAMP(3),
    "proposed_schedule" TEXT,
    "series_length" INTEGER,
    "term_name" TEXT,
    "syllabus" TEXT,
    "application_required" BOOLEAN NOT NULL DEFAULT false,
    "performer_seats" INTEGER,
    "observer_seats" INTEGER,
    "event_type" TEXT,
    "durations_offered" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_edits" (
    "id" TEXT NOT NULL,
    "offering_id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "review_notes" TEXT,

    CONSTRAINT "offering_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_preferences" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "timezone" TEXT,
    "weekly_hours" JSONB,
    "blocked_dates" JSONB,
    "seasonal_notes" TEXT,
    "lead_time_hours" INTEGER,
    "buffer_minutes" INTEGER,
    "max_sessions_per_day" INTEGER,
    "accepting_students" BOOLEAN,
    "pause_mode" BOOLEAN NOT NULL DEFAULT false,
    "pause_reason" TEXT,
    "notes_for_admin" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_media" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "visibility" TEXT NOT NULL,
    "sort_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_tech" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "zoom_link" TEXT,
    "camera_setup" TEXT,
    "microphone_setup" TEXT,
    "wifi_quality" TEXT,
    "backup_plan" TEXT,
    "tech_notes" TEXT,
    "tech_check_completed" BOOLEAN NOT NULL DEFAULT false,
    "tech_check_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_tech_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submitted_by" TEXT,
    "reviewed_by" TEXT,
    "review_notes" TEXT,
    "admin_internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_shopify" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "shopify_object_type" TEXT NOT NULL,
    "shopify_object_id" TEXT,
    "shopify_handle" TEXT,
    "sync_status" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sync_steps" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_shopify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_appointo" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "appointo_id" TEXT,
    "sync_status" TEXT NOT NULL,
    "configuration_notes" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_appointo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "object_type" TEXT,
    "object_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_tracking" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "gross_revenue" DECIMAL(10,2) NOT NULL,
    "platform_fees" DECIMAL(10,2) NOT NULL,
    "teacher_payout" DECIMAL(10,2) NOT NULL,
    "payout_status" TEXT NOT NULL,
    "payout_method" TEXT,
    "payout_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "faculty_id" TEXT,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_comments" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "author_id" TEXT,
    "comment" TEXT NOT NULL,
    "visible_to_teacher" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculty_email_key" ON "faculty"("email");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_application_faculty_id_key" ON "faculty_application"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "availability_preferences_faculty_id_key" ON "availability_preferences"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_tech_faculty_id_key" ON "faculty_tech"("faculty_id");

-- CreateIndex
CREATE INDEX "approvals_object_type_object_id_idx" ON "approvals"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "approvals"("status");

-- CreateIndex
CREATE INDEX "approvals_object_type_status_idx" ON "approvals"("object_type", "status");

-- CreateIndex
CREATE INDEX "sync_shopify_object_type_object_id_idx" ON "sync_shopify"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "sync_shopify_sync_status_idx" ON "sync_shopify"("sync_status");

-- CreateIndex
CREATE INDEX "sync_appointo_object_type_object_id_idx" ON "sync_appointo"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "sync_appointo_sync_status_idx" ON "sync_appointo"("sync_status");

-- CreateIndex
CREATE INDEX "audit_log_object_id_idx" ON "audit_log"("object_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_key" ON "magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "admin_comments_object_type_object_id_idx" ON "admin_comments"("object_type", "object_id");

-- AddForeignKey
ALTER TABLE "faculty_application" ADD CONSTRAINT "faculty_application_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_edits" ADD CONSTRAINT "profile_edits_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_edits" ADD CONSTRAINT "offering_edits_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_preferences" ADD CONSTRAINT "availability_preferences_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_media" ADD CONSTRAINT "faculty_media_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_tech" ADD CONSTRAINT "faculty_tech_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_tracking" ADD CONSTRAINT "payout_tracking_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
