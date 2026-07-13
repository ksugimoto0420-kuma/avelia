-- #9-followup: メールテンプレート編集を管理画面から可能にする

-- CreateTable
CREATE TABLE "email_templates" (
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("kind")
);
