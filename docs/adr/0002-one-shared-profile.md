# Use one shared profile for the CRM and AlumniDB

The owner maintains one CRM profile with additional nullable fields for AlumniDB rather than a separately edited directory copy. Once explicitly published, changes to directory-visible fields appear immediately, avoiding duplicate editing and synchronization; unpublishing removes directory visibility without erasing CRM information.

This deliberately replaces the proposed separate directory record/editor. Directory reads must still project only the agreed fields, so resumes, login addresses, roles, and other private CRM data remain private. Publication eligibility uses directory-specific completeness and graduation rules rather than treating the existing CRM completion reminder as equivalent.
