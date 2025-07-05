-- CreateTable
CREATE TABLE "usage" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "expire" TIMESTAMP(3),

    CONSTRAINT "usage_pkey" PRIMARY KEY ("key")
);
