-- Widen cvss_vector column to accommodate full CVSS:3.1 vectors (Base + Temporal + Environmental)
ALTER TABLE "category_findings" ALTER COLUMN "cvss_vector" TYPE varchar(150);
