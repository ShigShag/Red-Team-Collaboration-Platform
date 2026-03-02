"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import {
  addContact,
  removeContact,
  decryptPhone,
  type ScopeState,
} from "./scope-actions";

interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  hasPhone: boolean;
  encryptedPhone: string | null;
  isPrimary: boolean;
  createdAt: string;
}

interface Props {
  contacts: Contact[];
  engagementId: string;
  canWrite: boolean;
}

export function ContactsCard({ contacts, engagementId, canWrite }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [addState, addAction, addPending] = useActionState(addContact, {});
  const [removeState, removeAction, removePending] = useActionState(removeContact, {});
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (addState.success) {
      setName("");
      setTitle("");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
      setShowForm(false);
    }
  }, [addState.success]);

  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Contacts
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
          </span>
          {canWrite && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {contacts.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted/50 text-center py-4">
          No contacts defined
        </p>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              engagementId={engagementId}
              canWrite={canWrite}
              removeAction={removeAction}
              removePending={removePending}
            />
          ))}
        </div>
      )}

      {removeState.error && (
        <p className="text-xs text-red-400 mt-2">{removeState.error}</p>
      )}

      {showForm && canWrite && (
        <form action={addAction} className="mt-4 border-t border-border-default/50 pt-4 space-y-3">
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="isPrimary" value={isPrimary ? "true" : "false"} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
              {addState.fieldErrors?.name && (
                <p className="text-[10px] text-red-400 mt-0.5">{addState.fieldErrors.name[0]}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Title <span className="font-normal text-text-muted/50">(optional)</span>
              </label>
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="CISO, IT Manager"
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Email <span className="font-normal text-text-muted/50">(optional)</span>
              </label>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
              {addState.fieldErrors?.email && (
                <p className="text-[10px] text-red-400 mt-0.5">{addState.fieldErrors.email[0]}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Phone <span className="font-normal text-text-muted/50">(encrypted)</span>
              </label>
              <input
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100"
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-border-default bg-bg-primary text-accent focus:ring-accent/50"
            />
            <span className="text-xs text-text-secondary">Primary contact</span>
          </label>

          {addState.error && (
            <p className="text-xs text-red-400">{addState.error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default rounded transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPending || !name.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-bright disabled:opacity-40 rounded transition-colors duration-100"
            >
              {addPending ? "Adding..." : "Add Contact"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  engagementId,
  canWrite,
  removeAction,
  removePending,
}: {
  contact: Contact;
  engagementId: string;
  canWrite: boolean;
  removeAction: (payload: FormData) => void;
  removePending: boolean;
}) {
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealing, startReveal] = useTransition();

  const handleReveal = () => {
    if (revealedPhone) {
      setRevealedPhone(null);
      return;
    }
    if (!contact.encryptedPhone) return;
    startReveal(async () => {
      const phone = await decryptPhone(engagementId, contact.encryptedPhone!);
      setRevealedPhone(phone);
    });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded bg-bg-elevated/30 group">
      {contact.isPrimary && (
        <svg
          className="w-3.5 h-3.5 shrink-0 text-amber-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
        </svg>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {contact.name}
          </span>
          {contact.title && (
            <span className="text-xs text-text-muted">
              {contact.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="text-xs text-accent hover:text-accent-bright transition-colors duration-100"
            >
              {contact.email}
            </a>
          )}
          {contact.hasPhone && (
            <button
              onClick={handleReveal}
              disabled={revealing}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors duration-100 inline-flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {revealing
                ? "..."
                : revealedPhone
                  ? revealedPhone
                  : "Reveal phone"}
            </button>
          )}
        </div>
      </div>
      {canWrite && (
        <form action={removeAction} className="shrink-0">
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="contactId" value={contact.id} />
          <button
            type="submit"
            disabled={removePending}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all duration-100"
            title="Remove"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
