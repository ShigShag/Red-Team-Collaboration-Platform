import type { OllamaToolDefinition } from "./ollama-client";

export const chatTools: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_engagement_summary",
      description:
        "Get an overview of the current engagement including name, status, dates, team size, and finding/action counts by severity.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_findings",
      description:
        "List vulnerability findings in this engagement. Can filter by severity level and category name. Returns title, severity, CVSS score, category, and MITRE tags.",
      parameters: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info", "fixed"],
            description: "Filter by severity level",
          },
          categoryName: {
            type: "string",
            description: "Filter by category name (partial match)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_finding_detail",
      description:
        "Get the full detail of a specific finding including overview, impact, recommendation, CVSS vector, tags, and linked resources. Use list_findings first to get finding IDs.",
      parameters: {
        type: "object",
        properties: {
          findingId: {
            type: "string",
            description: "The UUID of the finding to retrieve",
          },
        },
        required: ["findingId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_actions",
      description:
        "List red team actions/operations performed in this engagement. Returns title, timestamp, operator, category, and tags.",
      parameters: {
        type: "object",
        properties: {
          categoryName: {
            type: "string",
            description: "Filter by category name (partial match)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description:
        "List all categories in this engagement with their finding count, action count, and hierarchy.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_scope_targets",
      description:
        "List in-scope targets for this engagement (IP addresses, CIDRs, domains, URLs, networks).",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["ip", "cidr", "domain", "url", "network", "other"],
            description: "Filter by target type",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_scope_exclusions",
      description:
        "List out-of-scope exclusions for this engagement with their justification.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_mitre_techniques",
      description:
        "Search MITRE ATT&CK techniques by name, ID, or tactic. Returns technique ID, name, and tactic.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search term to match against technique name or MITRE ID (e.g. 'T1190' or 'brute force')",
          },
          tactic: {
            type: "string",
            description:
              "Filter by tactic (e.g. 'initial-access', 'execution', 'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'exfiltration', 'command-and-control', 'impact')",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_resources",
      description:
        "List resources (evidence containers) in a category. Shows name, description, and field types but never shows encrypted/secret values.",
      parameters: {
        type: "object",
        properties: {
          categoryName: {
            type: "string",
            description: "Filter by category name (partial match)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_engagement_stats",
      description:
        "Get analytics data: severity distribution, average CVSS, findings per category, total actions, and team member count.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_ip_geolocations",
      description:
        "List IP addresses found during the engagement with their country information.",
      parameters: {
        type: "object",
        properties: {
          countryCode: {
            type: "string",
            description: "Filter by 2-letter country code (e.g. 'US', 'DE')",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_activity",
      description:
        "List recent activity/audit log events for this engagement. Shows who did what and when — e.g. findings created, members joined, scope changes, actions logged, status changes. Can filter by event type and/or actor name.",
      parameters: {
        type: "object",
        properties: {
          eventType: {
            type: "string",
            enum: [
              "category_created",
              "category_updated",
              "category_deleted",
              "resource_created",
              "resource_updated",
              "resource_deleted",
              "action_created",
              "action_updated",
              "action_deleted",
              "finding_created",
              "finding_updated",
              "finding_deleted",
              "member_joined",
              "member_removed",
              "member_role_changed",
              "engagement_status_changed",
              "comment_created",
              "scope_target_added",
              "scope_target_removed",
            ],
            description: "Filter by specific event type",
          },
          actor: {
            type: "string",
            description:
              "Filter by actor username or display name (partial match, case-insensitive)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default 20, max 50)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_content",
      description:
        "Full-text search across findings (title, overview, impact, recommendation), actions (title, content/description), and resource field values. Use this to find specific IPs, hostnames, commands, hashes, usernames, or any text that appears in engagement data. Does NOT search encrypted/secret fields.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The text to search for (e.g. an IP address, hostname, username, command, hash). Minimum 2 characters.",
          },
          scope: {
            type: "string",
            enum: ["all", "findings", "actions", "resources"],
            description:
              "Limit search to a specific data type (default: all)",
          },
        },
        required: ["query"],
      },
    },
  },
];
