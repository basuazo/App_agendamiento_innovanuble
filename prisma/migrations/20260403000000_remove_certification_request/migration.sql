-- Drop CertificationRequest table and CertReqStatus enum
-- The certification flow is now direct (admin certifies/revokes directly)

DROP TABLE IF EXISTS "CertificationRequest";
DROP TYPE IF EXISTS "CertReqStatus";
