-- Add code column for 6-digit verification codes
ALTER TABLE "magic_link_tokens" ADD COLUMN "code" TEXT;

-- Add index for email + code lookups
CREATE INDEX "magic_link_tokens_email_code_idx" ON "magic_link_tokens"("email", "code");
