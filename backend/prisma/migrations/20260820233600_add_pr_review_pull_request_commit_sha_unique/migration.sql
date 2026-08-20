-- CreateIndex
CREATE UNIQUE INDEX "pr_reviews_pull_request_id_commit_sha_key" ON "pr_reviews"("pull_request_id", "commit_sha");
