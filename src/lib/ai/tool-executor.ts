import { listFindings, getFindingDetail } from "./queries/findings";
import { listActions } from "./queries/actions";
import { listCategories } from "./queries/categories";
import { listScopeTargets, listScopeExclusions } from "./queries/scope";
import { searchMitreTechniques } from "./queries/mitre";
import { getEngagementSummary, getEngagementStats } from "./queries/stats";
import { listResources } from "./queries/resources";
import { listIpGeolocations } from "./queries/ips";
import { listActivity } from "./queries/activity";
import { searchContent } from "./queries/search";

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  engagementId: string
): Promise<string> {
  try {
    switch (toolName) {
      case "get_engagement_summary":
        return await getEngagementSummary(engagementId);

      case "list_findings":
        return await listFindings(engagementId, args as {
          severity?: string;
          categoryName?: string;
          limit?: number;
        });

      case "get_finding_detail":
        if (!args.findingId || typeof args.findingId !== "string") {
          return "Error: findingId is required.";
        }
        return await getFindingDetail(engagementId, {
          findingId: args.findingId,
        });

      case "list_actions":
        return await listActions(engagementId, args as {
          categoryName?: string;
          limit?: number;
        });

      case "list_categories":
        return await listCategories(engagementId);

      case "list_scope_targets":
        return await listScopeTargets(engagementId, args as {
          type?: string;
        });

      case "list_scope_exclusions":
        return await listScopeExclusions(engagementId);

      case "search_mitre_techniques":
        return await searchMitreTechniques(args as {
          query?: string;
          tactic?: string;
        });

      case "list_resources":
        return await listResources(engagementId, args as {
          categoryName?: string;
        });

      case "get_engagement_stats":
        return await getEngagementStats(engagementId);

      case "list_ip_geolocations":
        return await listIpGeolocations(engagementId, args as {
          countryCode?: string;
        });

      case "list_activity":
        return await listActivity(engagementId, args as {
          eventType?: string;
          actor?: string;
          limit?: number;
        });

      case "search_content":
        if (!args.query || typeof args.query !== "string") {
          return "Error: query is required.";
        }
        return await searchContent(engagementId, {
          query: args.query,
          scope: (args.scope as string) ?? "all",
        });

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return `Error executing ${toolName}: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
