-- Adds a deterministic display position so shoe items keep their intake order.
ALTER TABLE "OrderItem" ADD COLUMN "position" INTEGER;

UPDATE "OrderItem"
SET "position" = ordered.rank - 1
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "orderId" ORDER BY "createdAt", "id") AS rank
  FROM "OrderItem"
) AS ordered
WHERE "OrderItem"."id" = ordered."id";

ALTER TABLE "OrderItem" ALTER COLUMN "position" SET NOT NULL;
