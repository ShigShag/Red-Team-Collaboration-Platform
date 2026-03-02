import Link from "next/link";
import { getAllSettings } from "@/lib/platform-settings";
import { getChatStats } from "../actions";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const [settings, chatStats] = await Promise.all([
    getAllSettings(),
    getChatStats(),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors duration-100 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Admin
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Configuration
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Platform Settings
        </h1>
      </div>

      <SettingsForm settings={settings} chatStats={chatStats} />
    </div>
  );
}
