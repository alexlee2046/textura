ALTER TABLE "organizations" ADD CONSTRAINT "chk_credits_non_negative" CHECK ("credits" >= 0);
