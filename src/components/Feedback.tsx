"use client";
import { useId, useState } from "react";
import { Mail, MessageSquareHeart, Send } from "@/components/icons";
import { Button, Field, Input, Modal, Segmented, Textarea, Toggle } from "./ui";
import { openUrl } from "@/lib/api";
import { useApp } from "@/lib/store";

/** Feedback goes to the developer. With a Web3Forms key (added when the app is built)
    it is sent straight from the app; otherwise it opens a ready-written email. */
export const FEEDBACK_EMAIL = "areedzgonzales@gmail.com";
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";

type Kind = "idea" | "problem" | "praise" | "other";
const KINDS: { value: Kind; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
];

function system(version: string) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const os = /Windows NT 10/.test(ua) ? "Windows 10 or 11" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown";
  return `Schedulr ${version || "preview"}, ${os}`;
}

function emailLinks(subject: string, body: string) {
  const q = (s: string) => encodeURIComponent(s);
  return {
    mailto: `mailto:${FEEDBACK_EMAIL}?subject=${q(subject)}&body=${q(body)}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${q(FEEDBACK_EMAIL)}&su=${q(subject)}&body=${q(body)}`,
  };
}

export function FeedbackForm({ onSent }: { onSent?: () => void }) {
  const version = useApp((s) => s.version);
  const name = useApp((s) => s.settings.profile?.name ?? "");
  const toast = useApp((s) => s.toast);
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [withSystem, setWithSystem] = useState(true);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const uid = useId();

  const label = KINDS.find((k) => k.value === kind)!.label;
  const subject = `Schedulr feedback: ${label}`;
  const body = [message.trim(), "", name && `From: ${name}`, reply && `Reply to: ${reply}`, withSystem && system(version)].filter((l) => l !== false && l !== "").join("\n");
  const links = emailLinks(subject, body);
  const direct = !!WEB3FORMS_KEY;

  function done() {
    setMessage("");
    setFailed(false);
    onSent?.();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    if (!direct) {
      await openUrl(links.mailto).catch(() => openUrl(links.gmail));
      toast("Your email app opened with the message. Press Send there.");
      done();
      return;
    }
    if (!navigator.onLine) {
      setFailed(true);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject,
          from_name: name || "Schedulr user",
          ...(reply.trim() ? { email: reply.trim(), replyto: reply.trim() } : {}),
          kind: label,
          message: message.trim(),
          ...(withSystem ? { system: system(version) } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!res.ok || !data.success) throw new Error("not sent");
      toast("Thank you! Your feedback was sent.");
      done();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Segmented label="Kind of feedback" value={kind} onChange={setKind} options={KINDS} className="self-start" />
      <Field label="Your message" htmlFor={`${uid}-message`}>
        <Textarea
          id={`${uid}-message`}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind === "problem" ? "What happened, and what did you expect?" : "Tell me what you think."}
          className="min-h-[130px]"
        />
      </Field>
      <Field label="Your email, if you would like a reply" htmlFor={`${uid}-reply`} hint="Optional.">
        <Input id={`${uid}-reply`} type="email" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <Toggle label="Include the app version and system" checked={withSystem} onChange={setWithSystem} />
        Include the app version and system ({system(version)})
      </label>
      {failed && (
        <div role="alert" className="clay-sunk flex flex-col gap-2 rounded-[18px] px-4 py-3 text-sm text-ink">
          <p className="font-semibold text-danger">Your feedback could not be sent. Check your internet connection, or send it by email instead.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => openUrl(links.mailto)}>
              <Mail size={16} /> Email app
            </Button>
            <Button type="button" size="sm" onClick={() => openUrl(links.gmail)}>
              <Mail size={16} /> Gmail
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" tone="primary" disabled={!message.trim() || sending}>
          <Send size={17} /> {sending ? "Sending…" : direct ? "Send feedback" : "Write the email"}
        </Button>
        {!direct && (
          <button type="button" onClick={() => message.trim() && openUrl(links.gmail)} className="text-sm font-semibold text-terracotta underline underline-offset-4 disabled:opacity-50" disabled={!message.trim()}>
            Use Gmail in the browser instead
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        {direct ? "Sent to the developer of Schedulr." : `Opens a ready-written email to ${FEEDBACK_EMAIL}.`} Nothing else from your planner is included.
      </p>
    </form>
  );
}

/** The feedback button in the top bar. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button tone="clay" size="icon" aria-label="Send feedback" title="Send feedback" onClick={() => setOpen(true)}>
        <MessageSquareHeart size={19} />
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Send feedback" description="Ideas, problems or praise. Every message is read.">
        <div className="pb-2">
          <FeedbackForm onSent={() => setOpen(false)} />
        </div>
      </Modal>
    </>
  );
}
