-- Drop the preview-only columns.
--
-- The wall behind the Custom Studio preview, and where the frame was dragged or rotated
-- on it, were being stored with every design. Nothing downstream ever read them: the
-- workshop cuts to the size, moulding, thickness, mat and glazing, and prints the
-- customer's photo. Where a simulated frame sat on a simulated wall is not a production
-- input, and keeping a customer's room photograph on our server to support a preview is
-- worse than useless — the wall photo now stays in the browser as an object URL.
--
-- Dead columns are worse than absent ones: someone will eventually read them and believe
-- they mean something.

ALTER TABLE "custom_designs" DROP COLUMN IF EXISTS "room_image_path";--> statement-breakpoint
ALTER TABLE "custom_designs" DROP COLUMN IF EXISTS "transform";--> statement-breakpoint
ALTER TABLE "custom_designs" DROP COLUMN IF EXISTS "wall_preset";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "transform";
