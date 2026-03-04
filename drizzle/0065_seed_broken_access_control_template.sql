-- Seed finding template for broken function-level access control
INSERT INTO "finding_templates" ("title", "category", "overview", "overview_format", "impact", "impact_format", "recommendation", "recommendation_format", "severity", "cvss_score", "cvss_vector", "is_system")
VALUES
(
  'Broken Function-Level Access Control',
  'web',
  E'The application does not properly enforce function-level access control, allowing users with restricted permissions (e.g., read-only roles) to perform privileged actions such as creating, modifying, or deleting data. While the user interface may hide or disable certain controls based on the user''s role, the server-side API endpoints do not validate whether the authenticated user is authorized to perform the requested operation.\n\nDuring testing, it was confirmed that an account assigned a read-only role was able to issue write requests (e.g., POST, PUT, PATCH, DELETE) directly to API endpoints and successfully modify data. The application accepted these requests without returning an authorization error, indicating that role-based access control is enforced only at the presentation layer and not on the server side.',
  'markdown',
  E'An attacker or malicious insider with a low-privilege account could:\n\n- **Modify, create, or delete data** despite being granted only read access, compromising data integrity\n- **Escalate privileges vertically** by invoking administrative functions (e.g., user management, configuration changes) that should be restricted to higher-privileged roles\n- **Bypass business workflows** such as approval chains or review processes by directly invoking state-changing endpoints\n- **Tamper with audit trails** if logging or monitoring functions are also unprotected\n- **Undermine the principle of least privilege**, rendering the entire role-based access control model ineffective',
  'markdown',
  E'1. **Enforce authorization checks server-side** on every API endpoint and controller action — never rely solely on client-side UI restrictions to control access\n2. **Implement a centralized access control mechanism** (e.g., middleware or policy engine) that maps each endpoint or operation to the required role or permission, and denies access by default\n3. **Apply the principle of least privilege** — ensure each role is granted only the minimum set of permissions necessary for its function\n4. **Deny by default** — any endpoint not explicitly authorized for a given role should return HTTP 403 Forbidden\n5. **Conduct authorization testing** across all roles for every API endpoint, including tests that attempt to access functions outside the role''s intended scope\n6. **Log and monitor** authorization failures to detect and respond to privilege escalation attempts\n7. **Review and harden API documentation** to ensure that internal or administrative endpoints are not inadvertently exposed or discoverable',
  'markdown',
  'high',
  8.1,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H',
  true
);
