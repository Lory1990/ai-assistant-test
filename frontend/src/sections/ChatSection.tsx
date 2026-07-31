import { useEffect, useRef, useState } from 'react'
import {
  useConversations,
  useConversation,
  useSendChatMessage,
  useDeleteConversation,
  useInvalidateAllData,
} from '../queries'

function ConversationList({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  const { data: conversations, isLoading } = useConversations()
  const removeConversation = useDeleteConversation()

  return (
    <div className="hud-panel conversation-list">
      <h3>Conversazioni</h3>
      <button className="hud-button" style={{ width: '100%' }} onClick={onNew}>
        Nuova
      </button>

      {isLoading && <p className="empty">Caricamento...</p>}
      {conversations && conversations.length === 0 && <p className="empty">Nessuna conversazione salvata.</p>}

      {conversations?.map((c) => (
        <div key={c.id} className={`conversation-item ${c.id === activeId ? 'is-active' : ''}`}>
          <button className="conversation-item__title" onClick={() => onSelect(c.id)}>
            <span>{c.title}</span>
            <span className="conversation-item__date">{new Date(c.lastMessageAt).toLocaleString('it-IT')}</span>
          </button>
          <button
            className="logout"
            title="Elimina conversazione"
            onClick={() => {
              removeConversation.mutate(c.id, {
                // Se si elimina quella aperta, si torna a una chat vuota.
                onSuccess: () => c.id === activeId && onNew(),
              })
            }}
          >
            elimina
          </button>
        </div>
      ))}
    </div>
  )
}

function ChatSection() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const { data: opened } = useConversation(conversationId)
  const sendMessage = useSendChatMessage()
  const invalidateAll = useInvalidateAllData()
  const logRef = useRef<HTMLDivElement>(null)

  const messages = opened?.messages ?? []

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages.length, sendMessage.isPending])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sendMessage.isPending) return
    setInput('')

    sendMessage.mutate(
      { conversationId: conversationId ?? undefined, message: text },
      {
        onSuccess: (res) => {
          // Al primo messaggio la conversazione la crea il server: da qui in poi
          // la teniamo aperta.
          setConversationId(res.conversationId)
          if (res.toolCalls.length > 0) invalidateAll()
        },
      },
    )
  }

  return (
    <div className="chat-layout">
      <ConversationList
        activeId={conversationId}
        onSelect={setConversationId}
        onNew={() => setConversationId(null)}
      />

      <div className="hud-panel chat-panel">
        <h3>{opened?.conversation.title ?? 'Assistente di famiglia'}</h3>
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && !sendMessage.isPending && (
            <p className="empty">
              Scrivi qualsiasi cosa: "accendi la luce del salotto", "ho mangiato 150g di pasta", "crea un obiettivo:
              bere più acqua", "com'è andata la palestra questa settimana?"...
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-message chat-message--${m.role}`}>
              <span className="chat-message__role">{m.role === 'user' ? 'Tu' : 'Assistente'}</span>
              <span className="chat-message__content">
                {m.content}
                {m.toolNames.length > 0 && (
                  <span className="chat-message__tools">🔧 {m.toolNames.join(', ')}</span>
                )}
              </span>
            </div>
          ))}
          {sendMessage.isPending && <p className="empty">L'assistente sta scrivendo...</p>}
          {sendMessage.isError && <p className="empty">{(sendMessage.error as Error).message}</p>}
        </div>

        <form onSubmit={send} className="chat-form">
          <input
            className="hud-input"
            placeholder="Scrivi un messaggio..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="hud-button" type="submit" disabled={sendMessage.isPending}>
            Invia
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatSection
