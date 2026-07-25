"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Mic, Sparkles, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, IconTile } from "@/components/kit"
import { conversations, quickActions, toneVar, user } from "@/lib/mock-data"

type Message = { id: number; from: "me" | "ai"; text: string }

const replies = [
  "Here is a plan: two focus blocks before noon, then the Acme sync at 3. I moved the changelog to Friday so nothing overlaps.",
  "I scanned 3 docs and 6 tasks. The onboarding drop-off is your only blocker — want me to draft the fix ticket?",
  "Done. I drafted the weekly report from your closed tasks and added the focus score chart at the top.",
]

export function AssistantView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      from: "ai",
      text: `Morning ${user.first}. You have 4 tasks due and 2 meetings. Your focus score is ${user.focusScore} — want me to protect a deep work block?`,
    },
  ])
  const [value, setValue] = useState("")
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, thinking])

  function send(text: string) {
    const clean = text.trim()
    if (!clean) return
    setValue("")
    setMessages((prev) => [...prev, { id: Date.now(), from: "me", text: clean }])
    setThinking(true)
    window.setTimeout(() => {
      setThinking(false)
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: "ai", text: replies[prev.filter((m) => m.from === "me").length % replies.length] },
      ])
    }, 1100)
  }

  return (
    <>
      <header className="flex items-center gap-3">
        <IconTile tone="coral" size={40} soft={false}>
          <Sparkles className="size-5" strokeWidth={2.3} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Assistant</h1>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ background: toneVar("mint") }} />
            Connected to Texxel HQ
          </p>
        </div>
        <button
          type="button"
          aria-label="New conversation"
          className="press grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
        >
          <Wand2 className="size-[18px]" strokeWidth={2.2} />
        </button>
      </header>

      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex animate-rise gap-2", m.from === "me" ? "justify-end" : "items-end")}>
            {m.from === "ai" ? (
              <IconTile tone="coral" size={26} className="mb-1">
                <Sparkles className="size-3.5" strokeWidth={2.4} />
              </IconTile>
            ) : null}
            <p
              className={cn(
                "max-w-[78%] px-4 py-3 text-[14px] leading-relaxed shadow-soft text-pretty",
                m.from === "me"
                  ? "rounded-[22px] rounded-br-lg bg-primary text-primary-foreground"
                  : "rounded-[22px] rounded-bl-lg border border-border bg-card",
              )}
            >
              {m.text}
            </p>
            {m.from === "me" ? <Avatar initials={user.initials} size={26} className="mb-1" /> : null}
          </div>
        ))}

        {thinking ? (
          <div className="flex items-end gap-2">
            <IconTile tone="coral" size={26} className="mb-1">
              <Sparkles className="size-3.5" strokeWidth={2.4} />
            </IconTile>
            <span className="flex items-center gap-1 rounded-[22px] rounded-bl-lg border border-border bg-card px-4 py-4 shadow-soft">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground/60"
                  style={{ animation: `breathe 1s ease-in-out ${i * 140}ms infinite` }}
                />
              ))}
            </span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <section className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Try</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {quickActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => send(a.label)}
              className="press flex w-[152px] shrink-0 flex-col gap-1 rounded-2xl border border-border bg-card p-3 text-left shadow-soft"
              style={{ background: `color-mix(in oklch, ${toneVar(a.tone)} 8%, var(--card))` }}
            >
              <span className="text-[13px] font-semibold leading-snug">{a.label}</span>
              <span className="text-[11px] text-muted-foreground">{a.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Recent</p>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => send(c.title)}
            className="press flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-soft"
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneVar(c.tone) }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{c.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{c.preview}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">{c.time}</span>
          </button>
        ))}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(value)
        }}
        className="sticky bottom-24 z-20 -mx-1 flex items-center gap-2 rounded-full border border-border bg-card/90 p-1.5 pl-4 shadow-lift backdrop-blur-xl"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return
              e.preventDefault()
              send(value)
            }
          }}
          placeholder="Ask anything about your work"
          aria-label="Message the assistant"
          className="min-w-0 flex-1 bg-transparent py-2 text-[14px] outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Voice input"
          className="press grid size-9 place-items-center rounded-full text-muted-foreground"
        >
          <Mic className="size-[18px]" strokeWidth={2.2} />
        </button>
        <button
          type="submit"
          aria-label="Send message"
          className="press grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.6} />
        </button>
      </form>
    </>
  )
}
