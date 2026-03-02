"use client";

import type {
  ToolEntry,
  TestingEnvironment,
} from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";
import { FieldInput } from "./field-input";
import { QAFieldWrapper } from "./qa-field-wrapper";

interface Props {
  tools: ToolEntry[];
  environment: TestingEnvironment;
  onToolsChange: (tools: ToolEntry[]) => void;
  onEnvironmentChange: (env: TestingEnvironment) => void;
  disabled: boolean;
  onDisabledChange: (disabled: boolean) => void;
}

export function ToolsEnvironmentSection({
  tools,
  environment,
  onToolsChange,
  onEnvironmentChange,
  disabled,
  onDisabledChange,
}: Props) {
  const hasData =
    tools.length > 0 || environment.platform.length > 0;

  return (
    <div className="space-y-2">
      {/* Toggle control */}
      <div className="flex items-center justify-between px-1 py-2 bg-bg-surface/40 rounded border border-border-default">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            8. Appendix A — Tools & Environment
          </span>
          {disabled && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
              Excluded from report
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-text-secondary">Include in report</span>
          <input
            type="checkbox"
            checked={!disabled}
            onChange={(e) => onDisabledChange(!e.target.checked)}
            className="w-4 h-4 rounded border-border-default bg-bg-base text-accent focus:ring-2 focus:ring-accent/50"
          />
        </label>
      </div>

      {!disabled && (
        <SectionCard
          title="8. Appendix A — Tools & Environment"
          subtitle={`${tools.length} tool${tools.length !== 1 ? "s" : ""}`}
          status={hasData ? "custom" : "needs-input"}
        >
          <div className="space-y-4 mt-2">
            <div>
              <h4 className="text-xs font-medium text-text-primary mb-2">
                Tools Used
              </h4>
              <ArrayFieldEditor
                items={tools}
                onChange={onToolsChange}
                fields={[
                  {
                    key: "name",
                    label: "Tool",
                    placeholder: "Burp Suite Professional",
                  },
                  { key: "version", label: "Version", placeholder: "2025.12" },
                  {
                    key: "purpose",
                    label: "Purpose",
                    placeholder: "Web application proxy, scanning",
                    wide: true,
                  },
                ]}
                emptyItem={{ name: "", version: "", purpose: "" }}
                addLabel="Add tool"
              />
            </div>

            <div>
              <h4 className="text-xs font-medium text-text-primary mb-2">
                Testing Environment
              </h4>
              <div className="space-y-2">
                <QAFieldWrapper sectionKey="tools_environment" fieldPath="environment.platform">
                  <FieldInput
                    label="Platform"
                    value={environment.platform}
                    onChange={(v) =>
                      onEnvironmentChange({ ...environment, platform: v })
                    }
                    placeholder="Kali Linux 2025.4 (x86_64)"
                  />
                </QAFieldWrapper>
                <QAFieldWrapper sectionKey="tools_environment" fieldPath="environment.source_ips">
                  <FieldInput
                    label="Source IPs"
                    value={environment.source_ips}
                    onChange={(v) =>
                      onEnvironmentChange({ ...environment, source_ips: v })
                    }
                    placeholder="203.0.113.50, 203.0.113.51"
                  />
                </QAFieldWrapper>
                <QAFieldWrapper sectionKey="tools_environment" fieldPath="environment.vpn">
                  <FieldInput
                    label="VPN / Tunnel"
                    value={environment.vpn}
                    onChange={(v) =>
                      onEnvironmentChange({ ...environment, vpn: v })
                    }
                    placeholder="WireGuard tunnel to client jump host"
                  />
                </QAFieldWrapper>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
