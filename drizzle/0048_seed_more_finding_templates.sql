-- Seed additional system finding templates (expands vulnerability knowledge base)
INSERT INTO "finding_templates" ("title", "category", "overview", "overview_format", "impact", "impact_format", "recommendation", "recommendation_format", "severity", "cvss_score", "cvss_vector", "is_system")
VALUES
-- ============================================================
-- WEB
-- ============================================================
(
  'XML External Entity (XXE) Injection',
  'web',
  E'The application parses XML input from users without disabling external entity resolution. An attacker can craft malicious XML payloads that reference external entities, causing the server to read local files, make outbound HTTP requests to internal or external resources, or trigger denial of service through recursive entity expansion (the "billion laughs" attack).\n\nDuring testing, an XML payload containing an external entity definition was submitted to [endpoint], and the contents of server-side files (such as `/etc/passwd`) were successfully exfiltrated in the application response.',
  'markdown',
  E'Successful exploitation of this vulnerability could allow an attacker to:\n\n- **Read arbitrary server files** including `/etc/passwd`, application configuration, and source code\n- **Perform server-side request forgery (SSRF)** to access internal network resources and cloud metadata endpoints\n- **Cause denial of service** through recursive entity expansion (billion laughs / XML bomb attacks)\n- **Exfiltrate sensitive data** out-of-band via DNS or HTTP callbacks when direct response output is not available\n- **Compromise application secrets** including database credentials, API keys, and encryption keys stored in configuration files',
  'markdown',
  E'1. **Disable external entity processing** entirely in the XML parser configuration (e.g., `disallow-doctype-decl`, `external-general-entities=false`, `external-parameter-entities=false`)\n2. **Use less complex data formats** such as JSON where possible instead of XML\n3. **Validate and sanitize** XML input using an allow-list schema before processing\n4. **Upgrade XML parsing libraries** to versions that disable external entities by default\n5. **Implement network-level egress controls** to limit the server''s ability to make outbound connections',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
  true
),
(
  'Server-Side Template Injection (SSTI)',
  'web',
  E'The application embeds user-controlled input directly into server-side template expressions without sanitization. An attacker can inject template syntax that is evaluated by the server-side template engine (e.g., Jinja2, Twig, Freemarker, Velocity), achieving arbitrary code execution on the server.\n\nDuring testing, a template expression payload such as `{{7*7}}` was submitted and the server returned the evaluated result `49`, confirming that user input is interpreted as template code. Further exploitation demonstrated the ability to execute operating system commands on the underlying server.',
  'markdown',
  E'Successful exploitation of this vulnerability could allow an attacker to:\n\n- **Achieve remote code execution** on the application server with the privileges of the web application process\n- **Read, modify, or delete** any data accessible to the application\n- **Pivot to internal systems** by establishing reverse shells or accessing internal network resources\n- **Compromise the entire server** and potentially the broader infrastructure\n- **Access application secrets** including database credentials and API keys stored in the server environment',
  'markdown',
  E'1. **Never concatenate user input** into template strings — pass user data as context variables to the template rendering engine\n2. **Use a logic-less template engine** or sandbox mode where available (e.g., Jinja2 sandbox)\n3. **Implement strict input validation** and reject template syntax characters from user input\n4. **Apply the principle of least privilege** to the application process — run with minimal OS permissions\n5. **Deploy runtime application self-protection (RASP)** to detect and block template injection attempts',
  'markdown',
  'critical',
  9.8,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  true
),
(
  'Broken Authentication and Session Management',
  'web',
  E'The application exhibits weaknesses in its authentication and session management implementation. Identified issues include one or more of the following: session tokens that do not expire or rotate after login, session fixation vulnerabilities, predictable session identifiers, failure to invalidate sessions on logout, or insecure transmission of session tokens without the Secure and HttpOnly cookie flags.\n\nDuring testing, it was confirmed that [specific finding, e.g., session tokens remained valid after logout, or session identifiers were predictable]. These weaknesses allow an attacker to hijack user sessions, bypass authentication, or maintain persistent unauthorized access.',
  'markdown',
  E'An attacker exploiting these weaknesses could:\n\n- **Session hijacking** allowing full impersonation of the victim user\n- **Account takeover** without knowledge of the user''s credentials\n- **Privilege escalation** if administrative sessions can be hijacked or fixated\n- **Persistent unauthorized access** when sessions are not properly invalidated\n- **Bypass of multi-factor authentication** if post-authentication session tokens are compromised',
  'markdown',
  E'1. **Regenerate session identifiers** after successful authentication to prevent session fixation\n2. **Implement absolute and idle session timeouts** appropriate to the application''s risk profile (e.g., 30-minute idle timeout)\n3. **Invalidate sessions server-side** on logout — do not rely solely on deleting the client-side cookie\n4. **Use cryptographically random session identifiers** of sufficient length (minimum 128 bits of entropy)\n5. **Set Secure, HttpOnly, and SameSite flags** on all session cookies\n6. **Monitor for concurrent sessions** and alert users to active sessions from new locations or devices',
  'markdown',
  'high',
  8.1,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
  true
),
(
  'Open Redirect',
  'web',
  E'The application accepts user-controlled input in a URL redirect parameter and redirects the user to that destination without validating that the target URL belongs to a trusted domain. An attacker can craft a link that appears to originate from the legitimate application but redirects the victim to a malicious website.\n\nDuring testing, the redirect parameter at [endpoint, e.g., `/login?redirect=`] was modified to point to an external domain, and the application redirected the user to the attacker-controlled site without warning.',
  'markdown',
  E'An attacker could use this vulnerability to:\n\n- **Credential phishing** by redirecting users from a trusted domain to a convincing fake login page\n- **Malware delivery** by redirecting users to sites hosting drive-by downloads or exploit kits\n- **Bypass email/URL security filters** that trust the legitimate domain, allowing the malicious redirect to pass through\n- **Erode user trust** in the application when the legitimate domain is used as a vehicle for attacks',
  'markdown',
  E'1. **Avoid using user-controlled input** in redirect destinations where possible\n2. **Validate redirect URLs** against a strict allow-list of approved domains and paths\n3. **Use relative paths** for internal redirects instead of full URLs\n4. **Implement a redirect confirmation page** that warns users before redirecting to external domains\n5. **Encode or map redirect destinations** to opaque identifiers that the server resolves to pre-approved URLs',
  'markdown',
  'medium',
  4.7,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:N/I:L/A:N',
  true
),
-- ============================================================
-- NETWORK
-- ============================================================
(
  'SMB Signing Disabled',
  'network',
  E'SMB (Server Message Block) signing is not required on one or more systems in the network. SMB signing provides packet-level integrity verification, ensuring that SMB communications have not been tampered with in transit. Without mandatory signing, an attacker on the local network can perform NTLM relay attacks by intercepting authentication requests and relaying them to other systems that accept SMB connections.\n\nDuring testing, multiple systems were identified with SMB signing set to "enabled but not required" or fully disabled. Combined with LLMNR/NBT-NS poisoning or ARP spoofing, this configuration allows direct relay of captured authentication to these systems.',
  'markdown',
  E'Exploitation of this misconfiguration allows an attacker to:\n\n- **NTLM relay attacks** allowing authentication to target systems as the intercepted user\n- **Remote code execution** if relayed credentials have administrative privileges on the target\n- **Lateral movement** across systems that accept unsigned SMB connections\n- **Data interception and modification** of SMB traffic in transit\n- **Domain compromise** when relayed authentication reaches privileged resources such as domain controllers',
  'markdown',
  E'1. **Require SMB signing** on all systems via Group Policy: Computer Configuration → Policies → Windows Settings → Security Settings → Local Policies → Security Options → "Microsoft network server: Digitally sign communications (always)" = Enabled\n2. **Enable SMB signing on clients** as well: "Microsoft network client: Digitally sign communications (always)" = Enabled\n3. **Disable SMBv1** across the environment — it has known vulnerabilities and weaker signing support\n4. **Enable EPA (Extended Protection for Authentication)** on LDAP and other NTLM-accepting services\n5. **Implement network segmentation** to limit the attacker''s ability to position themselves for relay attacks',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
(
  'Unencrypted Protocol Usage (Telnet/FTP/HTTP)',
  'network',
  E'One or more systems in the environment are running services that transmit data in cleartext using unencrypted protocols such as Telnet (port 23), FTP (port 21), or HTTP (port 80) for administrative or sensitive operations. An attacker with access to the network segment can passively capture credentials, session tokens, and sensitive data using network sniffing tools.\n\nDuring testing, network traffic analysis revealed credentials being transmitted in plaintext over [protocol] to [system/service]. These credentials were captured using passive network interception techniques.',
  'markdown',
  E'An attacker on the network could:\n\n- **Credential theft** through passive network sniffing, capturing usernames and passwords in cleartext\n- **Session hijacking** by capturing session tokens or cookies transmitted without encryption\n- **Sensitive data exposure** including configuration data, personal information, and business data\n- **Man-in-the-middle attacks** allowing modification of data in transit\n- **Compliance violations** against PCI-DSS, HIPAA, and other standards that mandate encryption of data in transit',
  'markdown',
  E'1. **Replace Telnet with SSH** for all remote administration tasks\n2. **Replace FTP with SFTP or SCP** for file transfers\n3. **Enforce HTTPS** on all web interfaces and redirect HTTP to HTTPS with HSTS headers\n4. **Disable legacy unencrypted services** entirely where replacements have been deployed\n5. **Implement network monitoring** to detect any new instances of unencrypted protocol usage\n6. **Use TLS 1.2 or later** for all encrypted protocols and disable legacy cipher suites',
  'markdown',
  'medium',
  6.5,
  'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
  true
),
(
  'IPv6 Man-in-the-Middle via SLAAC/DHCPv6',
  'network',
  E'The network environment has IPv6 enabled on host interfaces but lacks IPv6-specific security controls such as Router Advertisement (RA) Guard or DHCPv6 snooping. An attacker on the local network can exploit this by deploying a rogue IPv6 router or DHCPv6 server to assign themselves as the default gateway or DNS server for IPv6 traffic. Because most modern operating systems prefer IPv6 over IPv4, this effectively places the attacker in a man-in-the-middle position for all outbound traffic.\n\nDuring testing, tools such as mitm6 were used to respond to DHCPv6 requests and advertise a rogue DNS server. This resulted in victim machines sending DNS queries (and subsequently NTLM authentication) to the attacker-controlled host.',
  'markdown',
  E'An attacker exploiting this weakness could:\n\n- **Intercept all network traffic** by becoming the default IPv6 gateway or DNS server\n- **Capture NTLM authentication** by spoofing DNS responses and triggering WPAD or proxy authentication\n- **Relay captured credentials** to Active Directory services (LDAP, SMB) for unauthorized access\n- **Redirect users** to attacker-controlled servers for credential phishing or malware delivery\n- **Bypass IPv4-only security controls** such as ARP inspection that do not cover IPv6',
  'markdown',
  E'1. **Implement RA Guard** on network switches to block rogue IPv6 router advertisements\n2. **Enable DHCPv6 snooping** on managed switches to prevent rogue DHCPv6 servers\n3. **Disable IPv6 on host interfaces** if it is not actively used in the environment (via Group Policy or network configuration)\n4. **Deploy IPv6 network monitoring** to detect rogue router advertisements and DHCPv6 responses\n5. **Disable WPAD** via Group Policy and DNS if not required, as it is a primary exploitation vector for IPv6 MitM',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- ACTIVE DIRECTORY
-- ============================================================
(
  'DCSync Attack — Replication Privilege Abuse',
  'active_directory',
  E'One or more Active Directory accounts possess replication privileges (Replicating Directory Changes and Replicating Directory Changes All) that allow them to request password data from domain controllers using the Directory Replication Service (DRS) protocol. An attacker who compromises such an account can perform a DCSync attack, extracting the NTLM password hashes for any account in the domain — including the krbtgt account used to forge Golden Tickets.\n\nDuring testing, the compromised account was used with Mimikatz''s `lsadump::dcsync` command to successfully extract the NTLM hash of the domain administrator and krbtgt accounts.',
  'markdown',
  E'Successful DCSync exploitation allows an attacker to:\n\n- **Extract all domain credentials** including every user, computer, and service account NTLM hash\n- **Forge Golden Tickets** using the krbtgt hash, granting persistent, unrestricted access to the entire domain\n- **Complete domain compromise** with full administrative control over all domain-joined systems\n- **Maintain persistent access** even after password resets (until krbtgt password is rotated twice)\n- **Move laterally** to any system in the domain using pass-the-hash with extracted credentials',
  'markdown',
  E'1. **Audit accounts with replication privileges** — enumerate all ACEs granting DS-Replication-Get-Changes and DS-Replication-Get-Changes-All on the domain object\n2. **Remove replication privileges** from all accounts except domain controllers and explicitly authorized service accounts\n3. **Monitor for DCSync activity** using security event IDs 4662 (directory service access) with GUID matching replication operations\n4. **Implement a tiered administration model** to isolate accounts with domain-level privileges\n5. **Rotate the krbtgt account password** twice in succession if DCSync is suspected to have been performed\n6. **Deploy credential guard** on domain controllers and privileged admin workstations',
  'markdown',
  'critical',
  9.0,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:N',
  true
),
(
  'Unconstrained Kerberos Delegation',
  'active_directory',
  E'One or more computer or service accounts in the Active Directory environment are configured with unconstrained Kerberos delegation. This setting causes the domain controller to include the authenticating user''s full Ticket Granting Ticket (TGT) in the service ticket sent to the delegated server. Any account that authenticates to a server with unconstrained delegation has their TGT cached in memory on that server, allowing an attacker who compromises the server to extract and reuse those TGTs.\n\nDuring testing, the following accounts were identified with unconstrained delegation enabled: [account names]. The Printer Bug (SpoolService) or PetitPotam technique was used to coerce a domain controller to authenticate to the compromised server, and the domain controller''s TGT was captured using Rubeus.',
  'markdown',
  E'An attacker could:\n\n- **Capture TGTs of any user or computer** that authenticates to the delegated server\n- **Coerce domain controller authentication** using the Printer Bug or PetitPotam to capture DC machine account TGTs\n- **Achieve domain compromise** by using the captured domain controller TGT to perform DCSync\n- **Impersonate any captured user** including domain administrators and service accounts\n- **Maintain persistent access** through captured high-privilege TGTs',
  'markdown',
  E'1. **Remove unconstrained delegation** from all accounts where it is not strictly required — audit with: `Get-ADComputer -Filter {TrustedForDelegation -eq $true}`\n2. **Migrate to constrained delegation** or resource-based constrained delegation (RBCD) which limits the services a delegate can access\n3. **Add sensitive accounts to the "Protected Users" group** to prevent their TGTs from being delegated\n4. **Mark high-privilege accounts** as "Account is sensitive and cannot be delegated" in AD properties\n5. **Disable the Print Spooler service** on domain controllers to prevent the Printer Bug coercion technique',
  'markdown',
  'high',
  8.1,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
  true
),
(
  'Group Policy Preference (GPP) Passwords in SYSVOL',
  'active_directory',
  E'Group Policy Preferences (GPP) stored in the SYSVOL share on domain controllers contain encrypted passwords in XML configuration files. Microsoft used a static AES-256 key to encrypt these passwords, and this key was publicly disclosed in 2012 (MS14-025). Any authenticated domain user can read SYSVOL and decrypt these passwords using readily available tools such as `gpp-decrypt` or the Get-GPPPassword module from PowerSploit.\n\nDuring testing, GPP XML files containing encrypted credentials were found in `\\\\[domain]\\SYSVOL\\[domain]\\Policies\\` directories. The passwords were decrypted, yielding plaintext credentials for [account types, e.g., local administrator accounts].',
  'markdown',
  E'Exploitation allows an attacker to:\n\n- **Recover plaintext credentials** for accounts configured through Group Policy Preferences\n- **Compromise local administrator accounts** across multiple systems if GPP was used to set local admin passwords\n- **Lateral movement** using the decrypted credentials on systems where the accounts are valid\n- **Privilege escalation** if the exposed credentials belong to service or administrative accounts\n- **Any authenticated user** can exploit this — no special privileges are required beyond domain membership',
  'markdown',
  E'1. **Delete all GPP XML files** containing `cpassword` attributes from SYSVOL immediately\n2. **Install MS14-025** on all domain controllers to prevent new GPP passwords from being created\n3. **Change all passwords** that were exposed through GPP — assume they are compromised\n4. **Implement LAPS (Local Administrator Password Solution)** for managing local administrator passwords instead of GPP\n5. **Audit SYSVOL regularly** for any sensitive data using automated scanning tools',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- CLOUD
-- ============================================================
(
  'Overly Permissive IAM Policies',
  'cloud',
  E'Identity and Access Management (IAM) policies in the cloud environment grant excessively broad permissions to users, roles, or service accounts. Policies using wildcard actions (e.g., `"Action": "*"` or `"Action": "s3:*"`) and wildcard resources (e.g., `"Resource": "*"`) provide far more access than required for the intended function. An attacker who compromises any principal with these permissions can access, modify, or destroy any resource within the cloud account.\n\nDuring testing, IAM analysis revealed [N] policies with wildcard permissions, including [specific examples]. These overly broad permissions would allow a compromised principal to escalate privileges, exfiltrate data from any service, or destroy cloud infrastructure.',
  'markdown',
  E'Overly permissive IAM policies could allow an attacker to:\n\n- **Privilege escalation** by creating new IAM users, attaching administrator policies, or modifying existing roles\n- **Full data access** to all cloud storage, databases, and secrets across the account\n- **Infrastructure destruction** including deletion of compute instances, databases, and backups\n- **Lateral movement** to other cloud services and accounts through overly broad cross-account or cross-service permissions\n- **Compliance violations** against CIS benchmarks, SOC 2, and cloud security best practices that mandate least privilege',
  'markdown',
  E'1. **Implement the principle of least privilege** — scope all IAM policies to the minimum actions and resources required\n2. **Replace wildcard policies** with specific action and resource ARN lists\n3. **Use IAM Access Analyzer** (AWS), Policy Insights (Azure), or IAM Recommender (GCP) to identify and remediate unused permissions\n4. **Implement SCP/permission boundaries** at the organizational level to set maximum permission guardrails\n5. **Require MFA** for all IAM console access and sensitive API operations\n6. **Conduct quarterly IAM reviews** to identify and remove stale or overly broad permissions',
  'markdown',
  'high',
  8.1,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
  true
),
(
  'Exposed Cloud Management Ports',
  'cloud',
  E'Cloud compute instances have security group or firewall rules that expose administrative management ports directly to the internet. Ports such as SSH (22), RDP (3389), database ports (3306, 5432, 1433, 27017), and container management ports (2375, 2376, 6443) are accessible from any source IP (0.0.0.0/0 or ::/0). This significantly increases the attack surface by allowing any internet-connected attacker to attempt authentication, exploit vulnerabilities, or brute-force credentials against these services.\n\nDuring testing, internet-facing cloud instances were identified with the following management ports publicly accessible: [port list]. Automated scanning confirmed these services are reachable and accepting connections from arbitrary external IP addresses.',
  'markdown',
  E'Exposed management ports allow an attacker to:\n\n- **Brute-force attacks** against SSH, RDP, and database authentication from any location worldwide\n- **Exploitation of service vulnerabilities** in exposed management services (e.g., unpatched SSH, RDP BlueKeep)\n- **Unauthorized access** if default or weak credentials are in use on the exposed services\n- **Data exfiltration** through direct connections to exposed database ports\n- **Ransomware deployment** via compromised RDP connections — a leading initial access vector for ransomware operators',
  'markdown',
  E'1. **Restrict security group rules** to allow management port access only from known, trusted IP ranges (VPN egress IPs, bastion host subnets)\n2. **Deploy a bastion host / jump server** or cloud-native session management (AWS SSM, Azure Bastion) for administrative access\n3. **Remove 0.0.0.0/0 and ::/0** rules from all security groups associated with management ports\n4. **Implement cloud security posture management (CSPM)** to continuously detect and alert on publicly exposed ports\n5. **Use VPN or Zero Trust Network Access (ZTNA)** for all administrative connections to cloud resources',
  'markdown',
  'high',
  8.1,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- API
-- ============================================================
(
  'Broken Object-Level Authorization (BOLA)',
  'api',
  E'The API does not enforce object-level authorization checks when processing requests that access specific resources. By manipulating object identifiers (IDs) in API requests, an authenticated user can access, modify, or delete resources belonging to other users or tenants. This is the OWASP API Security Top 10 #1 risk (API1:2023) and is the most prevalent and serious API vulnerability class.\n\nDuring testing, API requests were modified to reference object IDs belonging to other users. The API returned or modified these objects without verifying that the authenticated user was authorized to access them. For example, changing the user ID in `GET /api/v1/users/{id}/records` returned records belonging to a different user.',
  'markdown',
  E'An attacker could:\n\n- **Unauthorized data access** across all users and potentially all tenants in a multi-tenant application\n- **Data modification or deletion** of other users'' resources\n- **Mass data harvesting** by enumerating through object identifiers\n- **Privacy violations** exposing personal information, financial data, or health records\n- **Compliance failures** under GDPR, HIPAA, or PCI-DSS due to unauthorized data access',
  'markdown',
  E'1. **Implement object-level authorization checks** in every API endpoint that accesses a specific resource — verify the authenticated user owns or has permission to access the requested object\n2. **Use unpredictable identifiers** (UUIDs) instead of sequential integers to make enumeration harder (defense in depth, not a substitute for authorization)\n3. **Centralize authorization logic** in middleware or a policy engine rather than scattering checks across individual handlers\n4. **Write automated authorization tests** that verify cross-user access is denied for every endpoint\n5. **Log and monitor** for patterns of sequential ID enumeration or cross-user access attempts',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
  true
),
(
  'Mass Assignment / Excessive Data Exposure via API',
  'api',
  E'The API automatically binds client-supplied JSON or form data to internal data models without restricting which fields can be modified. An attacker can include additional fields in API requests that map to sensitive model properties not intended to be user-modifiable, such as `role`, `isAdmin`, `balance`, `verified`, or `permissions`.\n\nDuring testing, additional fields were injected into API requests (e.g., adding `"role": "admin"` to a profile update request), and the API accepted and persisted these values, modifying properties that should only be set by the system or administrators.',
  'markdown',
  E'Exploitation of mass assignment could allow an attacker to:\n\n- **Privilege escalation** by setting administrative flags or role fields on the attacker''s own account\n- **Business logic bypass** by modifying fields such as account balance, discount codes, or verification status\n- **Data integrity compromise** by altering fields that should be system-controlled (timestamps, ownership, status)\n- **Account takeover** if password or email fields can be overwritten through mass assignment\n- **Multi-tenant isolation breach** if tenant ID or organization fields can be modified',
  'markdown',
  E'1. **Use explicit allow-lists** (whitelists) to define which fields can be modified by the client for each API endpoint\n2. **Separate request DTOs from database models** — never bind API input directly to ORM entities\n3. **Implement role-based field access** so that different user roles can only modify their authorized subset of fields\n4. **Validate all incoming fields** against the expected schema and reject requests containing unexpected properties\n5. **Write tests** that verify sensitive fields cannot be modified through API endpoints intended for regular users',
  'markdown',
  'high',
  7.3,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- MOBILE
-- ============================================================
(
  'Insecure Local Data Storage',
  'mobile',
  E'The mobile application stores sensitive data in insecure local storage mechanisms that are accessible to an attacker with physical access to the device or a malicious application on a rooted/jailbroken device. Identified issues include storage of authentication tokens, credentials, personal data, or session information in plaintext SharedPreferences (Android), NSUserDefaults (iOS), unencrypted SQLite databases, or application log files.\n\nDuring testing, the application''s local data stores were examined on a rooted/jailbroken test device. Sensitive data including [authentication tokens / user credentials / personal information] was found stored in plaintext at [file path or storage location].',
  'markdown',
  E'Insecure local storage exposes the application to:\n\n- **Credential theft** from plaintext storage allowing account takeover\n- **Session hijacking** if authentication tokens are stored in accessible locations\n- **Personal data exposure** violating user privacy and potentially GDPR or HIPAA requirements\n- **Persistent compromise** if stored credentials grant access to backend systems\n- **Device theft scenarios** become significantly more severe when sensitive data is stored unencrypted',
  'markdown',
  E'1. **Use platform-provided secure storage** — Android Keystore / EncryptedSharedPreferences and iOS Keychain for all sensitive data\n2. **Never store credentials in plaintext** — use token-based authentication and store tokens securely\n3. **Encrypt SQLite databases** using SQLCipher or platform encryption APIs\n4. **Disable application logging** in production builds to prevent sensitive data leaking into log files\n5. **Implement data classification** to identify all sensitive data flows and ensure appropriate storage protections\n6. **Clear sensitive data from memory** when the application is backgrounded or terminated',
  'markdown',
  'medium',
  5.5,
  'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
  true
),
(
  'Missing or Bypassable Certificate Pinning',
  'mobile',
  E'The mobile application does not implement certificate pinning, or its certificate pinning implementation can be trivially bypassed using tools such as Frida, Objection, or SSLKillSwitch. Without effective certificate pinning, an attacker who can position themselves as a man-in-the-middle (e.g., on a shared Wi-Fi network or through a compromised router) can intercept and decrypt all HTTPS traffic between the application and its backend API using a rogue certificate.\n\nDuring testing, a proxy tool with a custom CA certificate was used to intercept the application''s HTTPS traffic. [Certificate pinning was not implemented / Certificate pinning was bypassed using Frida scripts], allowing full visibility into all API requests including authentication tokens and sensitive user data.',
  'markdown',
  E'An attacker in a man-in-the-middle position could:\n\n- **Intercept all API communications** including authentication credentials and session tokens\n- **Modify API requests and responses** in transit to alter application behavior\n- **Steal personal data** transmitted between the application and backend services\n- **Bypass client-side security controls** by modifying server responses\n- **Inject malicious content** into the application through modified API responses',
  'markdown',
  E'1. **Implement certificate pinning** by pinning the server''s public key (SPKI) rather than the full certificate to ease certificate rotation\n2. **Use multiple pinning approaches** — implement pinning at the network library level (OkHttp CertificatePinner, TrustKit) and verify it is not trivially bypassable\n3. **Implement root/jailbreak detection** and restrict functionality on compromised devices where pinning can be bypassed\n4. **Implement runtime integrity checks** to detect Frida, Xposed, and other instrumentation frameworks\n5. **Use mutual TLS (mTLS)** for high-security API endpoints as an additional authentication layer',
  'markdown',
  'medium',
  5.9,
  'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- WIRELESS
-- ============================================================
(
  'Evil Twin / Rogue Access Point',
  'wireless',
  E'The wireless network environment is susceptible to evil twin attacks, where an attacker deploys a rogue access point with the same SSID as the legitimate corporate network. Client devices in range automatically connect to the rogue access point if it presents a stronger signal, as most devices do not verify access point authenticity beyond matching the SSID. This places the attacker in a full man-in-the-middle position.\n\nDuring testing, a rogue access point broadcasting the corporate SSID was deployed. Client devices connected to the rogue AP without user interaction, and all network traffic — including credentials for internal web applications and email — was intercepted through the attacker-controlled gateway.',
  'markdown',
  E'An attacker operating an evil twin access point could:\n\n- **Intercept all network traffic** from connected devices including credentials, emails, and sensitive documents\n- **Capture corporate credentials** transmitted over the network, even those protected by HTTPS (via SSL stripping or captive portal phishing)\n- **Deploy man-in-the-middle attacks** to modify traffic, inject content, or redirect users to malicious sites\n- **Bypass network access controls** as the rogue AP is not subject to corporate network security policies\n- **Harvest WPA2-Enterprise credentials** if PEAP/MSCHAPv2 is in use without proper server certificate validation',
  'markdown',
  E'1. **Deploy 802.1X authentication (WPA2/WPA3-Enterprise)** with server certificate validation to prevent connections to rogue access points\n2. **Configure client devices** to validate the RADIUS server certificate and reject untrusted CAs\n3. **Implement Wireless Intrusion Detection/Prevention Systems (WIDS/WIPS)** to detect and alert on rogue access points\n4. **Disable auto-connect** for corporate SSIDs on managed devices to prevent automatic association with rogue APs\n5. **Use EAP-TLS** with mutual certificate authentication instead of PEAP/MSCHAPv2 to prevent credential capture',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
(
  'WPA2 Weak Pre-Shared Key (PSK)',
  'wireless',
  E'The wireless network uses WPA2-PSK (Pre-Shared Key) authentication with a weak or easily guessable passphrase. An attacker can capture the WPA2 four-way handshake by passively monitoring wireless traffic or by forcing a deauthentication to trigger a reconnection, then crack the PSK offline using dictionary attacks or brute force.\n\nDuring testing, the WPA2 four-way handshake was captured for the [SSID] network. The pre-shared key was cracked offline in [timeframe] using [tool, e.g., hashcat with a standard wordlist], revealing the passphrase to be [description, e.g., a common dictionary word with simple substitutions].',
  'markdown',
  E'A cracked PSK allows an attacker to:\n\n- **Full network access** for any attacker who obtains the PSK — the key is shared across all users\n- **Decryption of captured traffic** — past and future wireless traffic can be decrypted with the known PSK\n- **Man-in-the-middle attacks** against other wireless clients on the same network using ARP spoofing\n- **Lateral movement** to internal systems accessible from the wireless network\n- **Lack of individual accountability** since all users share the same key, making audit attribution impossible',
  'markdown',
  E'1. **Migrate to WPA2/WPA3-Enterprise (802.1X)** which uses individual credentials and does not share a single key\n2. **If PSK is required**, use a passphrase of at least 20 random characters including mixed case, numbers, and symbols\n3. **Rotate the PSK regularly** (at minimum quarterly) and whenever an employee with knowledge of the key departs\n4. **Segment the wireless network** from the corporate LAN using firewall rules and VLANs\n5. **Implement network access control (NAC)** to restrict wireless clients to authorized devices only',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- SOCIAL ENGINEERING
-- ============================================================
(
  'Successful Phishing Campaign — Credential Harvest',
  'social_engineering',
  E'A phishing simulation campaign was conducted against [N] employees as part of the social engineering assessment. Emails were crafted to impersonate [pretext, e.g., IT department password reset notifications, shared document alerts] and directed recipients to a controlled credential harvesting page that replicated the organization''s login portal.\n\nOf the [N] emails delivered, [X]% of recipients clicked the phishing link and [Y]% submitted their credentials on the phishing page. [Z] users also provided their MFA tokens when prompted. These results indicate a significant susceptibility to real-world phishing attacks, which are the primary initial access vector in the majority of data breaches.',
  'markdown',
  E'The phishing campaign results demonstrate exposure to:\n\n- **Credential compromise** of [Y]% of targeted employees, providing initial access to corporate systems\n- **MFA bypass** where users submitted one-time codes to the phishing page, enabling real-time account takeover\n- **Business email compromise (BEC)** using stolen credentials to send fraudulent emails from legitimate accounts\n- **Lateral movement** through the environment using harvested corporate credentials\n- **Data exfiltration** from email, file shares, and cloud applications accessible with the compromised credentials',
  'markdown',
  E'1. **Implement regular security awareness training** with a focus on phishing identification — conduct training at least quarterly\n2. **Run ongoing phishing simulations** to measure improvement and provide targeted remediation for repeat clickers\n3. **Deploy phishing-resistant MFA** such as FIDO2/WebAuthn hardware keys that cannot be phished via proxy\n4. **Implement email security controls** including DMARC (enforce), DKIM, SPF, and advanced threat protection with URL sandboxing\n5. **Enable suspicious login alerts** so users and administrators are notified of logins from new locations or devices\n6. **Establish a clear reporting mechanism** (e.g., a "Report Phish" button in the email client) and reward employees who report suspicious emails',
  'markdown',
  'high',
  7.3,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
  true
),
(
  'USB Drop Attack — Physical Media Execution',
  'social_engineering',
  E'As part of the physical social engineering assessment, USB drives containing simulated malicious payloads were placed in common areas including [locations, e.g., parking lot, lobby, break room, conference rooms]. The drives contained files designed to appear as legitimate documents (e.g., "Q4_Salary_Review.xlsx") that, when opened, would beacon to a controlled server to record the execution.\n\nOf the [N] USB drives deployed, [X] were picked up and [Y] resulted in payload execution on corporate workstations. This demonstrates that employees will connect unknown USB devices to corporate systems and open the files contained on them, providing a viable physical attack vector for malware delivery.',
  'markdown',
  E'Successful USB drop attacks could result in:\n\n- **Malware execution** on corporate workstations through social engineering — users opened files from untrusted USB drives\n- **Initial access** to the corporate network from a physical proximity attack\n- **Credential theft** through keyloggers or credential harvesting payloads executed from the USB device\n- **Ransomware delivery** — real-world attackers have used USB drops to deploy ransomware\n- **Bypass of perimeter security** — USB attacks circumvent email filters, web proxies, and network firewalls entirely',
  'markdown',
  E'1. **Implement USB device control policies** using endpoint management (e.g., Intune, Group Policy) to block unauthorized removable media\n2. **Conduct security awareness training** that specifically covers the dangers of connecting unknown USB devices\n3. **Deploy endpoint detection and response (EDR)** that can detect and block malicious payloads from removable media\n4. **Disable AutoRun/AutoPlay** on all corporate systems via Group Policy\n5. **Consider USB data diode solutions** or read-only USB policies for environments that require removable media',
  'markdown',
  'high',
  7.3,
  'CVSS:3.1/AV:P/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
  true
),
-- ============================================================
-- PHYSICAL
-- ============================================================
(
  'Tailgating / Unauthorized Physical Access',
  'physical',
  E'Physical security controls at [facility/office location] were bypassed through tailgating (following an authorized employee through a controlled access point without presenting credentials). During testing, the assessor gained unauthorized access to restricted areas including [areas, e.g., office floors, server rooms, executive areas] by following employees through badge-controlled doors and presenting a confident demeanor.\n\nNo employees challenged the unauthorized individual or asked for identification. In [N] attempts, [X] successful entries were achieved. Once inside, physical access was obtained to workstations, network ports, sensitive documents, and server infrastructure.',
  'markdown',
  E'Unauthorized physical access allows an attacker to:\n\n- **Access sensitive areas** including server rooms, executive offices, and restricted work areas\n- **Physical access to workstations** enabling keystroke loggers, USB rubber duckies, or malicious devices\n- **Network implant deployment** by connecting rogue devices to available network ports\n- **Document theft** of printed materials, whiteboards, and sticky notes containing credentials\n- **Badge cloning** opportunity if access cards can be read at close proximity during the tailgating interaction',
  'markdown',
  E'1. **Implement anti-tailgating measures** such as turnstiles, mantraps, or security vestibules at critical entry points\n2. **Conduct security awareness training** emphasizing that employees should challenge unfamiliar individuals and never hold doors for unknown persons\n3. **Deploy security cameras** with recording at all access control points and review footage regularly\n4. **Implement visitor management procedures** requiring sign-in, badges, and escorts for all non-employees\n5. **Conduct periodic physical penetration tests** and red team exercises to validate the effectiveness of physical security controls',
  'markdown',
  'medium',
  5.9,
  'CVSS:3.1/AV:P/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
  true
),
(
  'Unlocked and Unattended Workstations',
  'physical',
  E'During the physical security assessment, multiple workstations were found unlocked and unattended with active user sessions. Employees had left their desks without locking their computers (Win+L on Windows, Ctrl+Cmd+Q on macOS), leaving full access to their applications, emails, file shares, and any systems their accounts are authorized to access.\n\n[N] unlocked workstations were identified during the assessment across [areas]. In several cases, email clients, VPN connections, and internal applications were active and accessible. Automatic screen lock policies were either not configured or set to excessively long timeouts (greater than 15 minutes).',
  'markdown',
  E'Unlocked workstations expose the organization to:\n\n- **Full access to the user''s session** including email, file shares, internal applications, and cloud services\n- **Data theft** from any system the user is authenticated to\n- **Malware installation** or rogue device connection using the authenticated session\n- **Privilege abuse** performing actions as the authenticated user, with all operations attributed to them in audit logs\n- **Insider threat enablement** — any person with physical access can act as the authenticated user',
  'markdown',
  E'1. **Enforce automatic screen lock** via Group Policy with a maximum inactivity timeout of 5 minutes\n2. **Implement proximity-based locking** using Bluetooth tokens or smart cards that lock the workstation when the user walks away\n3. **Conduct security awareness training** emphasizing the importance of manually locking workstations (Win+L) whenever leaving the desk\n4. **Deploy endpoint monitoring** to detect and alert on suspicious activity from previously idle workstations\n5. **Implement clean desk policies** and conduct periodic compliance audits to reinforce the behavior',
  'markdown',
  'medium',
  5.9,
  'CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  true
),
-- ============================================================
-- CODE REVIEW
-- ============================================================
(
  'Hardcoded Secrets in Source Code',
  'code_review',
  E'Source code review identified hardcoded secrets including API keys, database credentials, encryption keys, and/or service account passwords embedded directly in application source files. These secrets are committed to the version control system and are accessible to all developers and anyone with access to the repository. If the repository is or becomes public, or if any developer account is compromised, all embedded secrets are immediately exposed.\n\nIdentified secrets include [types of secrets, e.g., AWS access keys in configuration files, database connection strings with credentials in source code, private keys in the repository]. These secrets were found in [file types/locations].',
  'markdown',
  E'Hardcoded secrets expose the organization to:\n\n- **Unauthorized access** to external services, APIs, and databases using the exposed credentials\n- **Full infrastructure compromise** if cloud provider access keys or admin credentials are exposed\n- **Data breach** through access to databases and services using hardcoded connection strings\n- **Difficult remediation** — secrets in version control history persist even after removal from current code and require history rewriting\n- **Supply chain risk** if the repository is forked, mirrored, or included as a dependency',
  'markdown',
  E'1. **Remove all hardcoded secrets** from source code immediately and rotate every exposed credential\n2. **Use a secrets management solution** such as HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, or environment variables injected at runtime\n3. **Implement pre-commit hooks** using tools like git-secrets, truffleHog, or gitleaks to prevent secrets from being committed\n4. **Scan the full repository history** for previously committed secrets and rotate all discovered credentials\n5. **Rewrite git history** using BFG Repo Cleaner or git filter-repo to remove secrets from all historical commits\n6. **Implement CI/CD pipeline secret scanning** as a mandatory quality gate',
  'markdown',
  'high',
  7.5,
  'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
  true
),
(
  'Insecure Deserialization',
  'code_review',
  E'The application deserializes untrusted data from user-controlled input without validation or integrity checks. Code review identified the use of insecure deserialization functions (e.g., Java''s `ObjectInputStream.readObject()`, Python''s `pickle.loads()`, PHP''s `unserialize()`, or .NET''s `BinaryFormatter.Deserialize()`) on data that an attacker can manipulate.\n\nInsecure deserialization can allow an attacker to craft serialized objects that, when deserialized by the application, trigger arbitrary code execution through gadget chains — sequences of existing classes in the application''s classpath that perform dangerous operations when their deserialization callbacks are invoked.',
  'markdown',
  E'Exploitation of insecure deserialization could allow an attacker to:\n\n- **Remote code execution** on the application server through deserialization gadget chains\n- **Full server compromise** with the privileges of the application process\n- **Data theft and manipulation** from any data stores accessible to the application\n- **Denial of service** through crafted objects that consume excessive resources during deserialization\n- **Authentication bypass** if serialized objects are used for session or token management',
  'markdown',
  E'1. **Avoid deserializing untrusted data** — use safe data formats such as JSON with explicit schema validation instead of native serialization\n2. **If deserialization is required**, implement strict type allow-lists (whitelists) to restrict which classes can be instantiated\n3. **Use integrity checks** (HMAC signatures) on all serialized data to detect tampering before deserialization\n4. **Upgrade libraries** to versions with known deserialization protections (e.g., Jackson with default typing disabled)\n5. **Monitor for deserialization exploitation** using RASP or application-level logging of deserialization operations\n6. **Replace dangerous deserializers** — use `ObjectInputFilter` in Java, avoid `pickle` in Python (use JSON instead), replace `BinaryFormatter` with `System.Text.Json` in .NET',
  'markdown',
  'critical',
  9.8,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  true
),
(
  'Verbose Error Messages and Stack Trace Exposure',
  'code_review',
  E'The application returns verbose error messages and full stack traces to end users when unhandled exceptions occur. These error responses disclose internal implementation details including framework versions, library names, file paths, database table and column names, SQL queries, and in some cases partial source code. While not directly exploitable on its own, this information significantly aids an attacker in developing targeted exploits.\n\nDuring code review, exception handling was found to be missing or insufficient in [locations/endpoints]. Triggering error conditions by submitting malformed input resulted in detailed stack traces being returned in the HTTP response body.',
  'markdown',
  E'Verbose error messages expose the application to:\n\n- **Information disclosure** of internal architecture, framework versions, and technology stack\n- **Database schema exposure** through SQL error messages revealing table names, column names, and query structure\n- **File path disclosure** revealing the application''s directory structure on the server\n- **Aid in exploit development** by providing attackers with specific version information to identify known vulnerabilities\n- **Credential exposure** in rare cases where connection strings or secrets appear in error output',
  'markdown',
  E'1. **Implement global exception handling** that returns generic error messages to users and logs detailed errors server-side only\n2. **Disable debug mode** in production — set `DEBUG=false`, `NODE_ENV=production`, or equivalent for the framework\n3. **Configure custom error pages** for all HTTP error status codes (400, 403, 404, 500, etc.)\n4. **Review all try/catch blocks** to ensure exceptions are caught and handled gracefully without leaking internal details\n5. **Use structured logging** to capture full error details in server-side log management systems (not in HTTP responses)',
  'markdown',
  'low',
  5.3,
  'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
  true
);
