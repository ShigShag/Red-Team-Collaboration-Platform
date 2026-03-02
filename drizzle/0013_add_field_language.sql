-- Add language column to resource_fields for code syntax highlighting
ALTER TABLE "resource_fields" ADD COLUMN "language" varchar(30);
