process.loadEnvFile();

async function seedMethodologyTemplates() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("./index");
  const { methodologyTemplates } = await import("./schema");

  type TemplateInsert = typeof methodologyTemplates.$inferInsert;

  const systemTemplates: Omit<
    TemplateInsert,
    "id" | "isSystem" | "createdBy" | "createdAt" | "updatedAt"
  >[] = [
    {
      name: "Web Application Penetration Test",
      category: "web",
      content: `**Phase 1 — Reconnaissance & Information Gathering:** Passive and active reconnaissance of the target application including technology stack fingerprinting, directory and file enumeration, subdomain discovery, and analysis of publicly available information (OSINT). Identification of application entry points, authentication mechanisms, and third-party integrations.

**Phase 2 — Application Mapping & Configuration Review:** Comprehensive mapping of the application's attack surface including URL structure, parameter identification, API endpoints, and session management mechanisms. Review of HTTP security headers, TLS configuration, cookie attributes, and error handling behavior.

**Phase 3 — Authentication & Session Management Testing:** Testing of authentication mechanisms for weaknesses including brute-force resistance, credential recovery flows, multi-factor authentication bypass, and session token entropy. Analysis of session fixation, session hijacking vectors, and privilege escalation through session manipulation.

**Phase 4 — Input Validation & Injection Testing:** Systematic testing of all user-controllable inputs for injection vulnerabilities including SQL injection, cross-site scripting (XSS), XML external entity (XXE) injection, server-side template injection (SSTI), and OS command injection. Testing aligned with OWASP Testing Guide v4.2 methodology.

**Phase 5 — Business Logic & Access Control Testing:** Analysis of application workflows for logic flaws, race conditions, and abuse scenarios. Testing of horizontal and vertical access controls, insecure direct object references (IDOR), and role-based authorization enforcement across all identified user roles.

**Phase 6 — Exploitation & Impact Validation:** Controlled exploitation of confirmed vulnerabilities to demonstrate real-world impact. Chaining of lower-severity issues where applicable to illustrate compounded risk. All exploitation conducted within the authorized scope and rules of engagement.

**Phase 7 — Reporting & Remediation Guidance:** Documentation of all findings with reproduction steps, evidence (screenshots, HTTP requests/responses), risk ratings aligned with CVSS v3.1, and prioritized remediation recommendations including both short-term mitigations and long-term architectural improvements.`,
    },
    {
      name: "Active Directory / Internal Network",
      category: "active_directory",
      content: `**Phase 1 — Network Reconnaissance & Discovery:** Host discovery, port scanning, and service enumeration across the authorized network ranges. Identification of domain controllers, DNS servers, DHCP servers, file shares, and other critical infrastructure components. Passive network traffic analysis where authorized.

**Phase 2 — Active Directory Enumeration:** Enumeration of the Active Directory environment including domain structure, trust relationships, group policies, user accounts, service accounts, and privileged group memberships. Identification of Kerberos delegation configurations, SPNs, and certificate services.

**Phase 3 — Credential Attacks & Initial Access:** Targeted credential attacks including password spraying against identified accounts, Kerberoasting of service accounts, AS-REP roasting of accounts without pre-authentication, and LLMNR/NBT-NS poisoning for credential capture. Testing of default and weak credentials on identified services.

**Phase 4 — Privilege Escalation:** Exploitation of misconfigurations to escalate privileges including unquoted service paths, insecure file permissions, registry-based attacks, token impersonation, and Group Policy preference credential extraction. Analysis of local administrator reuse across endpoints.

**Phase 5 — Lateral Movement & Persistence:** Simulation of lateral movement using obtained credentials and access, including pass-the-hash, pass-the-ticket, and overpass-the-hash techniques. Testing of WMI, PSRemoting, and SMB-based movement. Assessment of persistence opportunities through scheduled tasks, services, and registry modifications.

**Phase 6 — Domain Dominance & Objective Completion:** Attempts to achieve domain administrator-level access through attack chaining. Assessment of DCSync capabilities, NTDS.dit extraction feasibility, and Golden/Silver Ticket attack vectors. Testing of inter-forest trust abuse where multiple domains exist.

**Phase 7 — Reporting & Remediation Guidance:** Comprehensive documentation of the attack path from initial access to domain compromise, with detailed evidence, risk ratings, and prioritized remediation recommendations addressing both immediate fixes and strategic Active Directory hardening measures.`,
    },
    {
      name: "External Network / Infrastructure",
      category: "network",
      content: `**Phase 1 — Discovery & Reconnaissance:** Identification of externally-facing assets through DNS enumeration, certificate transparency log analysis, search engine discovery, and targeted port scanning. Mapping of the external attack surface including IP ranges, web servers, mail servers, VPN gateways, and remote access services.

**Phase 2 — Service Enumeration & Fingerprinting:** Detailed enumeration of discovered services including version identification, protocol analysis, and configuration assessment. Identification of outdated software, deprecated protocols (SSLv3, TLS 1.0/1.1), and exposed administrative interfaces.

**Phase 3 — Vulnerability Assessment:** Systematic vulnerability identification through a combination of automated scanning and manual validation. Assessment of known CVEs against identified service versions, default credential testing, and configuration weakness analysis. False positive elimination through manual verification.

**Phase 4 — Exploitation & Proof of Concept:** Controlled exploitation of confirmed vulnerabilities to validate exploitability and demonstrate business impact. Testing conducted with minimal disruption and within the agreed rules of engagement. Documentation of exploit chains where multiple vulnerabilities can be combined.

**Phase 5 — Post-Exploitation & Lateral Movement:** Where authorized, assessment of the potential for pivoting from compromised external services to internal network segments. Evaluation of network segmentation effectiveness and data exposure from externally-accessible services.

**Phase 6 — Reporting & Remediation Guidance:** Detailed documentation of all findings including network diagrams, reproduction steps, CVSS v3.1 ratings, and remediation guidance prioritized by risk and effort. Strategic recommendations for improving external perimeter security posture.`,
    },
    {
      name: "API Security Assessment",
      category: "api",
      content: `**Phase 1 — API Discovery & Documentation Review:** Review of API documentation (OpenAPI/Swagger, GraphQL schemas, WSDL) and identification of undocumented endpoints through traffic analysis, path brute-forcing, and source code examination where available. Mapping of API versioning, rate limiting, and available HTTP methods.

**Phase 2 — Authentication & Authorization Testing:** Assessment of API authentication mechanisms including API keys, OAuth 2.0 flows, JWT token validation, and session management. Testing for broken object-level authorization (BOLA), broken function-level authorization, and privilege escalation through API parameter manipulation.

**Phase 3 — Input Validation & Injection Testing:** Testing of all API parameters, headers, and request bodies for injection vulnerabilities including SQL injection, NoSQL injection, command injection, and Server-Side Request Forgery (SSRF). Assessment of data type enforcement, schema validation, and mass assignment vulnerabilities.

**Phase 4 — Business Logic & Rate Limiting:** Analysis of API workflows for logic flaws, race conditions, and abuse scenarios. Testing of rate limiting and throttling effectiveness, resource exhaustion vectors, and pagination/filtering bypass. Assessment of webhook and callback security where applicable.

**Phase 5 — Data Exposure & Security Configuration:** Review of API responses for excessive data exposure, verbose error messages, and information leakage. Assessment of CORS configuration, security headers, transport security, and API gateway configuration.

**Phase 6 — Reporting & Remediation Guidance:** Documentation of all findings aligned with the OWASP API Security Top 10, including reproduction steps with sample API requests/responses, CVSS v3.1 ratings, and remediation guidance covering both API-specific and application-level improvements.`,
    },
    {
      name: "Cloud Security Review",
      category: "cloud",
      content: `**Phase 1 — IAM & Access Control Review:** Assessment of identity and access management configuration including user roles, service accounts, privilege escalation paths, and policy misconfigurations. Review of MFA enforcement, credential rotation policies, and federated identity configurations.

**Phase 2 — Network Configuration & Segmentation:** Analysis of virtual network architecture including security group rules, network ACLs, VPC/VNet peering, and public IP exposure. Assessment of load balancer configurations, CDN security settings, and DNS zone configurations.

**Phase 3 — Storage & Data Protection Audit:** Review of object storage (S3/Blob/GCS) bucket policies, access controls, and encryption settings. Assessment of database security configurations, backup exposure, and data-at-rest/in-transit encryption enforcement. Testing for publicly accessible storage resources.

**Phase 4 — Compute & Workload Security:** Assessment of virtual machine, container, and serverless function configurations. Review of instance metadata service (IMDS) exposure, container image vulnerabilities, runtime security configurations, and function execution role permissions.

**Phase 5 — Logging, Monitoring & Incident Response:** Review of cloud audit logging configurations (CloudTrail, Activity Log, Audit Logs), log storage security, alerting rules, and incident response readiness. Assessment of security monitoring tool integration and anomaly detection capabilities.

**Phase 6 — Reporting & Remediation Guidance:** Documentation of all findings with cloud-provider-specific remediation steps, risk ratings, and architectural recommendations for improving cloud security posture aligned with CIS Benchmarks and cloud provider security best practices.`,
    },
    {
      name: "Mobile Application Security",
      category: "mobile",
      content: `**Phase 1 — Static Analysis & Reverse Engineering:** Decompilation and static analysis of the application binary to identify hardcoded credentials, API keys, insecure cryptographic implementations, and embedded secrets. Review of application permissions, code obfuscation effectiveness, and third-party library vulnerabilities.

**Phase 2 — Dynamic Analysis & Runtime Testing:** Runtime analysis of the application including method hooking, SSL/TLS pinning bypass assessment, and dynamic instrumentation using tools such as Frida. Testing of authentication flows, session management, and biometric authentication implementation.

**Phase 3 — Network Traffic Analysis:** Interception and analysis of all network communications including API calls, WebSocket connections, and background service traffic. Assessment of certificate validation, transport security, and data transmitted in cleartext. Testing for man-in-the-middle attack susceptibility.

**Phase 4 — Data Storage & Privacy Assessment:** Examination of local data storage mechanisms including shared preferences, SQLite databases, Keychain/Keystore usage, and file system storage. Assessment of data leakage through logs, clipboard, screenshots, and backup mechanisms. Review of compliance with applicable data protection requirements.

**Phase 5 — Platform-Specific Security Testing:** Assessment of platform-specific attack vectors including intent/URL scheme hijacking, deep link abuse, WebView configuration vulnerabilities, and inter-process communication security. Testing of root/jailbreak detection bypass and tamper detection mechanisms.

**Phase 6 — Reporting & Remediation Guidance:** Documentation of all findings aligned with the OWASP Mobile Application Security Verification Standard (MASVS), including reproduction steps, CVSS v3.1 ratings, and remediation guidance covering both application-level and backend API security improvements.`,
    },
    {
      name: "Wireless Network Assessment",
      category: "wireless",
      content: `**Phase 1 — Wireless Reconnaissance:** Discovery and enumeration of wireless networks within the assessment scope including SSID identification, signal strength mapping, encryption protocol identification (WPA2/WPA3/WEP), and channel analysis. Identification of hidden networks and rogue access points.

**Phase 2 — Encryption & Authentication Analysis:** Assessment of wireless encryption strength and authentication mechanisms including WPA2-PSK complexity analysis, WPA2-Enterprise (802.1X) configuration review, and RADIUS server security. Testing for downgrade attacks and protocol-level weaknesses.

**Phase 3 — Rogue Access Point & Evil Twin Testing:** Deployment of controlled rogue access points to assess client susceptibility to evil twin attacks and captive portal credential harvesting. Testing of wireless intrusion detection/prevention system (WIDS/WIPS) effectiveness and alert response.

**Phase 4 — Client-Side & Post-Authentication Attacks:** Assessment of network segmentation between wireless and wired networks. Testing for client isolation bypass, ARP spoofing, VLAN hopping, and man-in-the-middle opportunities on the wireless network. Evaluation of guest network isolation effectiveness.

**Phase 5 — Reporting & Remediation Guidance:** Documentation of all findings including wireless coverage maps, reproduction steps, risk ratings, and remediation guidance covering wireless infrastructure hardening, client configuration recommendations, and monitoring improvements.`,
    },
    {
      name: "Red Team Engagement",
      category: "general",
      content: `**Phase 1 — OSINT & Target Reconnaissance:** Comprehensive open-source intelligence gathering including employee enumeration, technology stack identification, social media analysis, credential breach database searches, and physical location reconnaissance. Development of target profiles and initial attack planning.

**Phase 2 — Initial Access:** Execution of targeted attacks to establish initial foothold including spear-phishing campaigns, external service exploitation, physical access attempts, and social engineering scenarios. All initial access vectors coordinated with the agreed rules of engagement and notification procedures.

**Phase 3 — Command & Control Establishment:** Deployment of covert command and control infrastructure following successful initial access. Assessment of egress filtering, network monitoring detection capabilities, and endpoint security tool evasion. Establishment of resilient communication channels.

**Phase 4 — Privilege Escalation & Credential Harvesting:** Escalation of privileges from initial access to administrative-level control through local exploit chains, credential theft, and Active Directory attack techniques. Assessment of endpoint detection and response (EDR) and privileged access management (PAM) effectiveness.

**Phase 5 — Lateral Movement & Objective Progression:** Movement through the target environment toward predefined objectives. Assessment of network segmentation, monitoring and alerting capabilities, and incident response detection thresholds. Documentation of detection opportunities at each stage.

**Phase 6 — Objective Completion & Impact Demonstration:** Achievement and documentation of agreed-upon objectives such as domain dominance, critical data access, or business process disruption simulation. All actions documented with timestamps for blue team debrief correlation.

**Phase 7 — Reporting, Debrief & Purple Team Review:** Comprehensive attack narrative with timeline, detection opportunities, and recommendations. Collaborative debrief with the defensive team correlating red team actions with blue team detections. Prioritized recommendations for improving detection and response capabilities.`,
    },
  ];

  // Check what already exists
  const existing = await db
    .select({ name: methodologyTemplates.name })
    .from(methodologyTemplates)
    .where(eq(methodologyTemplates.isSystem, true));

  const existingNames = new Set(existing.map((e) => e.name));
  const toInsert = systemTemplates.filter(
    (t) => !existingNames.has(t.name)
  );

  if (toInsert.length === 0) {
    console.log("All system methodology templates already exist, skipping.");
    return;
  }

  await db.insert(methodologyTemplates).values(
    toInsert.map((t) => ({
      ...t,
      isSystem: true,
      createdBy: null,
    }))
  );

  console.log(`Seeded ${toInsert.length} system methodology templates.`);
}

seedMethodologyTemplates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed methodology templates:", err);
    process.exit(1);
  });
