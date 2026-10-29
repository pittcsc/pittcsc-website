-- The alumni role is an immediate self-attestation through the Go API.
-- It remains additive and grants no extra permissions.
update csc.roles set description = 'Self-reported Pitt graduate; no additional permissions.' where name = 'alumni';
