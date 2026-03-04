-- Seed finding templates for missing logout functionality and session expiration issues
INSERT INTO "finding_templates" ("title", "category", "overview", "overview_format", "impact", "impact_format", "recommendation", "recommendation_format", "severity", "cvss_score", "cvss_vector", "is_system")
VALUES
(
  'Missing Logout Functionality',
  'web',
  E'The application does not provide a logout mechanism, or the logout function does not effectively terminate the user''s session on the server side. Without a working logout feature, users cannot voluntarily end their authenticated sessions, leaving active session tokens valid indefinitely or until they expire through other means.\n\nDuring testing, it was confirmed that the application [does not expose a logout button/link | has a logout button that does not invalidate the server-side session]. After performing the logout action (where available), the session token remained valid and could be reused to access authenticated resources without re-authentication.',
  'markdown',
  E'The absence of functional logout capability exposes users and the organization to the following risks:\n\n- **Persistent session exposure** — users on shared or public computers cannot end their sessions, leaving accounts accessible to the next user\n- **Session hijacking window** — stolen or leaked session tokens remain valid with no way for the victim to revoke them\n- **Compliance violations** — many regulatory frameworks (PCI DSS, HIPAA, SOC 2) require the ability to terminate sessions on demand\n- **Increased blast radius of token theft** — compromised tokens cannot be manually invalidated by the affected user\n- **Inability to respond to compromise** — users who suspect their account has been compromised have no self-service mechanism to terminate active sessions',
  'markdown',
  E'1. **Implement a visible and accessible logout function** on every authenticated page (e.g., in the navigation header or user menu)\n2. **Invalidate the session server-side** upon logout — delete or mark the session record/token as revoked in the session store; do not rely solely on clearing the client-side cookie\n3. **Clear all session cookies and tokens** on the client by setting them to empty values with an immediate expiry and the appropriate Secure, HttpOnly, and SameSite flags\n4. **Redirect the user** to the login page or a public landing page after logout to confirm the session has ended\n5. **Implement a "log out all sessions" feature** that allows users to revoke all active sessions across devices, providing a recovery path when compromise is suspected\n6. **Log logout events** in the application audit trail for security monitoring and incident response',
  'markdown',
  'medium',
  5.4,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N',
  true
),
(
  'Insufficient Session Expiration',
  'web',
  E'The application does not enforce adequate session expiration policies. Sessions remain valid for an excessively long period or do not expire at all, even after extended periods of user inactivity. This allows an attacker who obtains a valid session token — through network interception, cross-site scripting, or physical access to a user''s device — to maintain unauthorized access for an extended period.\n\nDuring testing, it was confirmed that session tokens remained valid after [extended inactivity period / several hours / days] without re-authentication being required. The application does not implement [idle timeout | absolute timeout | both idle and absolute timeouts], allowing sessions to persist well beyond a reasonable security window.',
  'markdown',
  E'Insufficient session expiration significantly increases the risk and impact of session-based attacks:\n\n- **Extended attack window** — stolen or intercepted session tokens remain usable for an excessive duration, giving attackers more time to exploit compromised credentials\n- **Unattended session abuse** — sessions left open on shared, public, or unattended devices remain accessible to unauthorized individuals\n- **Stale session accumulation** — long-lived sessions increase the number of valid tokens in circulation at any given time, expanding the attack surface\n- **Post-compromise persistence** — even after a password reset or account recovery, old sessions without expiration may continue to grant access\n- **Compliance violations** — session timeout requirements are mandated by PCI DSS (Requirement 8.2.8), NIST 800-53 (AC-12), HIPAA, and other regulatory frameworks',
  'markdown',
  E'1. **Implement an idle (inactivity) timeout** that terminates sessions after a period of no user activity — 15 to 30 minutes is recommended for standard applications, shorter for high-risk applications (e.g., banking, healthcare)\n2. **Implement an absolute session timeout** that forces re-authentication after a fixed duration regardless of activity (e.g., 8–12 hours for standard applications)\n3. **Invalidate sessions server-side** when timeouts are reached — do not rely solely on client-side cookie expiry, as attackers can replay captured tokens\n4. **Regenerate session tokens** after privilege changes (login, role elevation) to prevent session fixation in long-lived sessions\n5. **Invalidate all existing sessions** when a user changes their password or triggers account recovery, ensuring compromised sessions are revoked\n6. **Display session timeout warnings** to users before automatic logout to preserve usability while maintaining security\n7. **Configure appropriate cookie expiry attributes** — use session cookies (no Expires/Max-Age) for idle timeout enforcement and set Secure, HttpOnly, and SameSite flags',
  'markdown',
  'medium',
  5.4,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N',
  true
);
