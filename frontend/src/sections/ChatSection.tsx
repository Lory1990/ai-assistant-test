import { useState } from 'react'
import { useSendChatMessage, useInvalidateAllData } from '../queries'
import type { ChatMessage } from '../api/client'

function ChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const sendMessage = useSendChatMessage()
  const invalidateAll = useInvalidateAllData()

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sendMessage.isPending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')

    sendMessage.mutate(nextMessages, {
      onSuccess: (res) => {
        const toolNote = res.toolCalls.length > 0 ? `\n\n🔧 ${res.toolCalls.map((t) => t.name).join(', ')}` : ''
        setMessages([...nextMessages, { role: 'assistant', content: res.reply + toolNote }])
        if (res.toolCalls.length > 0) invalidateAll()
      },
    })
  }

  return (
    <div className="hud-panel chat-panel">
      <h3>Assistente di famiglia</h3>
      <div className="chat-log">
        {messages.length === 0 && (
          <p className="empty">
            Scrivi qualsiasi cosa: "accendi la luce del salotto", "ho mangiato 150g di pasta", "crea un obiettivo:
            bere più acqua", "com'è andata la palestra questa settimana?"...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-message chat-message--${m.role}`}>
            <span className="chat-message__role">{m.role === 'user' ? 'Tu' : 'Assistente'}</span>
            <span className="chat-message__content">{typeof m.content === 'string' ? m.content : ''}</span>
          </div>
        ))}
        {sendMessage.isPending && <p className="empty">L'assistente sta scrivendo...</p>}
      </div>
      {sendMessage.isError && <p className="empty">{(sendMessage.error as Error).message}</p>}
      <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          className="hud-input"
          placeholder="Scrivi un messaggio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sendMessage.isPending}
        />
        <button className="hud-button" type="submit" disabled={sendMessage.isPending}>
          Invia
        </button>
      </form>
    </div>
  )
}

export default ChatSection
