import { useState, useRef, useEffect, useCallback } from 'react';
import './ChatBot.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'bot';
  text: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ── Park data for mock responses ─────────────────────────────────────────────

const PRICE_EUR_PER_MWH = 74;

const PARK_DATA = [
  { key: 'eggebek',       name: 'Eggebek Solar Park',                 type: 'solar', state: 'Schleswig-Holstein',      capacity: 65,  gwh: 58.2,  d245: -1.8, d585: -3.1, risk: 5.4 },
  { key: 'weesow',        name: 'Solarpark Weesow-Willmersdorf',      type: 'solar', state: 'Brandenburg',              capacity: 187, gwh: 175.3, d245: -2.1, d585: -3.6, risk: 7.2 },
  { key: 'gottesgabe',    name: 'Solarpark Gottesgabe Neuhardenberg', type: 'solar', state: 'Brandenburg',              capacity: 84,  gwh: 78.8,  d245: -2.0, d585: -3.4, risk: 7.0 },
  { key: 'briest',        name: 'Brandenburg Briest Solarpark',       type: 'solar', state: 'Brandenburg',              capacity: 91,  gwh: 85.4,  d245: -2.2, d585: -3.7, risk: 7.1 },
  { key: 'finsterwalde',  name: 'Finsterwalde Solar Park',            type: 'solar', state: 'Brandenburg',              capacity: 80,  gwh: 76.0,  d245: -2.3, d585: -3.8, risk: 7.4 },
  { key: 'krughuette',    name: 'Krughuette Solar Park',              type: 'solar', state: 'Saxony-Anhalt',            capacity: 52,  gwh: 49.4,  d245: -2.0, d585: -3.3, risk: 6.8 },
  { key: 'meuro',         name: 'Solarpark Meuro',                    type: 'solar', state: 'Brandenburg / Saxony',     capacity: 166, gwh: 157.5, d245: -2.2, d585: -3.6, risk: 7.3 },
  { key: 'ernsthof',      name: 'Ernsthof Solar Park',                type: 'solar', state: 'Baden-Württemberg',        capacity: 70,  gwh: 70.0,  d245: -1.9, d585: -3.2, risk: 6.5 },
  { key: 'lauingen',      name: 'Lauingen Energy Park',               type: 'solar', state: 'Bavaria',                 capacity: 25,  gwh: 25.5,  d245: -1.8, d585: -3.0, risk: 6.3 },
  { key: 'strasskirchen', name: 'Strasskirchen Solar Park',           type: 'solar', state: 'Bavaria',                 capacity: 54,  gwh: 55.1,  d245: -1.7, d585: -2.9, risk: 6.2 },
  { key: 'pocking',       name: 'Solarpark Pocking',                  type: 'solar', state: 'Bavaria',                 capacity: 50,  gwh: 51.0,  d245: -1.8, d585: -3.0, risk: 6.4 },
  { key: 'reussenkoge',   name: 'Buergerwindpark Reussenkoge',        type: 'wind',  state: 'Schleswig-Holstein',       capacity: 30,  gwh: 118.5, d245: null, d585: null, risk: 3.5 },
  { key: 'holtriem',      name: 'Windpark Holtriem',                  type: 'wind',  state: 'Lower Saxony',            capacity: 70,  gwh: 196.0, d245: null, d585: null, risk: 3.2 },
  { key: 'kessin',        name: 'Windpark Kessin',                    type: 'wind',  state: 'Mecklenburg-Vorpommern',  capacity: 30,  gwh: 90.0,  d245: null, d585: null, risk: 3.8 },
  { key: 'druiberg',      name: 'Windpark Druiberg',                  type: 'wind',  state: 'Saxony-Anhalt',           capacity: 22,  gwh: 55.0,  d245: null, d585: null, risk: 4.1 },
  { key: 'hesselbach',    name: 'Hesselbach Wind Farm',               type: 'wind',  state: 'North Rhine-Westphalia',  capacity: 18,  gwh: 38.0,  d245: null, d585: null, risk: 3.9 },
  { key: 'harz',          name: 'Windpark Harz',                      type: 'wind',  state: 'Lower Saxony',            capacity: 35,  gwh: 92.0,  d245: null, d585: null, risk: 4.0 },
  { key: 'odervorland',   name: 'Windpark Odervorland',               type: 'wind',  state: 'Brandenburg',             capacity: 48,  gwh: 130.0, d245: null, d585: null, risk: 4.3 },
  { key: 'veenhusen',     name: 'Windpark Veenhusen',                 type: 'wind',  state: 'Lower Saxony',            capacity: 22,  gwh: 70.0,  d245: null, d585: null, risk: 3.4 },
  { key: 'hohegeest',     name: 'Windpark Hohe Geest',                type: 'wind',  state: 'Schleswig-Holstein',      capacity: 28,  gwh: 88.0,  d245: null, d585: null, risk: 3.6 },
];

const SUGGESTIONS = [
  'What\'s the forecast for Brandenburg Briest Solarpark?',
  'How exposed is Weesow-Willmersdorf to heat risk?',
  'Show me the revenue gap for Finsterwalde Solar Park',
];

// ── Mock response logic ───────────────────────────────────────────────────────

function findPark(text: string) {
  const lower = text.toLowerCase().replace(/[-_]/g, ' ');
  return PARK_DATA.find(p => {
    const words = p.name.toLowerCase().replace(/[-_]/g, ' ').split(' ').filter(w => w.length > 4);
    return words.some(w => lower.includes(w));
  });
}

function buildResponse(userText: string): string {
  const lower = userText.toLowerCase();
  const park  = findPark(userText);

  const isHeatQ    = /heat|risk|temp|warm|hot/.test(lower);
  const isRevenueQ = /revenue|money|€|eur|financial|finance|earn|cost|value/.test(lower);

  if (!park) {
    if (/list|all|which|parks/.test(lower)) {
      const solar = PARK_DATA.filter(p => p.type === 'solar').map(p => p.name).join(', ');
      const wind  = PARK_DATA.filter(p => p.type === 'wind').map(p => p.name).join(', ');
      return `I have data for 20 German renewable parks.\n\n**Solar parks (climate-adjusted):**\n${solar}\n\n**Wind parks (baseline only):**\n${wind}`;
    }
    return `I can answer questions about any of the 20 German parks in this tool.\n\nTry asking:\n• "What's the forecast for Eggebek Solar Park?"\n• "Revenue gap for Solarpark Meuro"\n• "Heat risk for Brandenburg Briest"\n\nOr ask "list all parks" to see the full roster.`;
  }

  const isSolar = park.type === 'solar';

  if (isHeatQ) {
    const level  = park.risk >= 7 ? 'high' : park.risk >= 5 ? 'moderate' : 'low';
    const detail = isSolar
      ? `For a solar park, high ambient temperatures directly reduce panel efficiency through thermal derating — and hotter summers accelerate panel degradation via the Arrhenius effect, compounding losses over 30 years.`
      : `Wind output is less sensitive to temperature than solar, but high-heat summers often correlate with low-wind conditions in central Europe.`;
    return `**Heat risk — ${park.name}**\n\nScore: ${park.risk}/10 (${level})\nLocation: ${park.state}\n\n${detail}`;
  }

  if (isRevenueQ && isSolar) {
    const lifetimeBase = park.gwh * 30 * 0.86;
    const revBase = (lifetimeBase * PRICE_EUR_PER_MWH) / 1000;
    const rev245  = revBase * (1 + park.d245! / 100);
    const rev585  = revBase * (1 + park.d585! / 100);
    const gap245  = rev245 - revBase;
    const gap585  = rev585 - revBase;
    return `**Revenue outlook — ${park.name}**\n\nIndustry standard (30 yr): €${revBase.toFixed(0)}M\n\nModerate Warming (SSP2-4.5): €${rev245.toFixed(0)}M · gap €${Math.abs(gap245).toFixed(0)}M (${park.d245!.toFixed(1)}%)\n\nHigh Emissions (SSP5-8.5): €${rev585.toFixed(0)}M · gap €${Math.abs(gap585).toFixed(0)}M (${park.d585!.toFixed(1)}%)\n\nPrice assumption: €${PRICE_EUR_PER_MWH}/MWh — illustrative only.`;
  }

  if (!isSolar) {
    return `**${park.name}** · Wind · ${park.state}\n\nCapacity: ${park.capacity} MW\nBaseline output: ~${park.gwh.toFixed(0)} GWh/year\n\nOur climate-adjustment model focuses on solar thermal derating — wind output projections under CMIP6 carry much higher uncertainty, so we report the baseline only for wind parks.\n\nHeat risk score: ${park.risk}/10`;
  }

  return `**${park.name}** · Solar · ${park.state}\n\nCapacity: ${park.capacity} MWp\nBaseline output: ~${park.gwh.toFixed(1)} GWh/year\n\nClimate-adjusted forecast (30-year lifetime):\n• Moderate Warming (SSP2-4.5): ${park.d245!.toFixed(1)}% vs. industry standard\n• High Emissions (SSP5-8.5): ${park.d585!.toFixed(1)}% vs. industry standard\n\nThe gap is driven mainly by temperature-accelerated panel degradation (Arrhenius effect) compounding over 30 years.\n\nHeat risk: ${park.risk}/10 · Ask me about the revenue impact for the full breakdown.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000)       return 'just now';
  if (d < 3_600_000)    return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000)   return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function makeTitle(text: string) {
  return text.length > 32 ? text.slice(0, 32) + '…' : text;
}

// ── Bot text renderer (simple **bold** + newlines) ────────────────────────────

function BotText({ text }: { text: string }) {
  return (
    <div className="bot-text">
      {text.split('\n').map((line, i) => {
        if (line === '') return <div key={i} className="bot-spacer" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="bot-line">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        );
      })}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

export function BotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2.5" />
      <path d="M8 8V6.5a4 4 0 0 1 8 0V8" />
      <circle cx="9" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M9.5 18h5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ── Chat list view ────────────────────────────────────────────────────────────

interface ChatListProps {
  chats: Chat[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

function ChatList({ chats, onOpen, onNew, onClose }: ChatListProps) {
  return (
    <>
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <span className="chatbot-avatar"><BotIcon size={18} /></span>
          <div>
            <div className="chatbot-title">Park Assistant</div>
            <div className="chatbot-subtitle">Powered by real park data</div>
          </div>
        </div>
        <div className="chatbot-header-actions">
          <button className="chatbot-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="chat-list-body">
        {chats.length === 0 ? (
          <div className="chat-list-empty">
            <div className="welcome-icon"><BotIcon size={28} /></div>
            <p className="welcome-title">No conversations yet</p>
            <p className="welcome-body">Ask me about any of the 20 German parks — forecasts, heat risk, revenue gaps.</p>
            <button className="btn-new-chat" onClick={onNew}>Start a conversation</button>
          </div>
        ) : (
          <>
            <div className="chat-list-toolbar">
              <span className="chat-list-count">{chats.length} conversation{chats.length !== 1 ? 's' : ''}</span>
              <button className="btn-new-chat-sm" onClick={onNew}>
                <ComposeIcon /> New chat
              </button>
            </div>
            <ul className="chat-list">
              {chats.map(chat => {
                const lastMsg = chat.messages[chat.messages.length - 1];
                const preview = lastMsg
                  ? (lastMsg.text.length > 48 ? lastMsg.text.slice(0, 48) + '…' : lastMsg.text)
                  : 'No messages yet';
                return (
                  <li key={chat.id}>
                    <button className="chat-list-item" onClick={() => onOpen(chat.id)}>
                      <span className="cli-avatar"><BotIcon size={14} /></span>
                      <span className="cli-body">
                        <span className="cli-title">{chat.title}</span>
                        <span className="cli-preview">{preview}</span>
                      </span>
                      <span className="cli-time">{relTime(chat.updatedAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

// ── Chat detail view ──────────────────────────────────────────────────────────

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  typing: boolean;
}

function ChatDetail({ chat, onBack, onClose, onSend, typing }: ChatDetailProps) {
  const [input, setInput] = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [chat.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, typing]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || typing) return;
    setInput('');
    onSend(t);
  }

  const isEmpty = chat.messages.length === 0;

  return (
    <>
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <button className="chatbot-icon-btn" onClick={onBack} aria-label="Back to chats">
            <BackIcon />
          </button>
          <span className="chatbot-title chat-detail-title" title={chat.title}>{chat.title}</span>
        </div>
        <button className="chatbot-icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="chatbot-messages">
        {isEmpty && (
          <div className="chatbot-welcome">
            <div className="welcome-icon"><BotIcon size={28} /></div>
            <p className="welcome-title">Ask me about any park</p>
            <p className="welcome-body">Forecasts, heat risk scores, revenue gaps — for all 20 parks.</p>
            <div className="suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="suggestion-chip" onClick={() => submit(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {chat.messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.role}`}>
            {m.role === 'bot' && <span className="msg-avatar"><BotIcon size={14} /></span>}
            <div className="msg-bubble">
              {m.role === 'bot' ? <BotText text={m.text} /> : m.text}
            </div>
          </div>
        ))}

        {typing && (
          <div className="msg-row bot">
            <span className="msg-avatar"><BotIcon size={14} /></span>
            <div className="msg-bubble typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chatbot-input-row">
        <input
          ref={inputRef}
          className="chatbot-input"
          placeholder="Ask about a park…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); } }}
        />
        <button
          className="chatbot-send"
          onClick={() => submit(input)}
          disabled={!input.trim() || typing}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </>
  );
}

// ── Root ChatBot component ────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChatBot({ open, onClose }: Props) {
  const [chats,         setChats]         = useState<Chat[]>([]);
  const [activeChatId,  setActiveChatId]  = useState<string | null>(null);
  const [view,          setView]          = useState<'list' | 'chat'>('list');
  const [typing,        setTyping]        = useState(false);

  // When opening with no chats, jump straight into a new chat
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (open && !didAutoOpen.current && chats.length === 0) {
      didAutoOpen.current = true;
      startNewChat();
    }
    if (!open) didAutoOpen.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startNewChat = useCallback(() => {
    const chat: Chat = {
      id:        makeId(),
      title:     'New conversation',
      messages:  [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats(prev => [chat, ...prev]);
    setActiveChatId(chat.id);
    setView('chat');
  }, []);

  function openChat(id: string) {
    setActiveChatId(id);
    setView('chat');
  }

  function goBack() {
    // Drop empty chats when leaving them
    setChats(prev => prev.filter(c => c.messages.length > 0));
    setActiveChatId(null);
    setView('list');
  }

  function handleClose() {
    // Drop empty chats on close too
    setChats(prev => prev.filter(c => c.messages.length > 0));
    onClose();
  }

  function send(text: string) {
    if (!activeChatId || typing) return;
    const id = activeChatId;

    // Add user message; set title from first message
    setChats(prev => prev.map(c => {
      if (c.id !== id) return c;
      const isFirst  = c.messages.length === 0;
      return {
        ...c,
        title:     isFirst ? makeTitle(text) : c.title,
        messages:  [...c.messages, { role: 'user' as const, text }],
        updatedAt: Date.now(),
      };
    }));

    setTyping(true);
    setTimeout(() => {
      const reply = buildResponse(text);
      setChats(prev => prev.map(c => {
        if (c.id !== id) return c;
        return {
          ...c,
          messages:  [...c.messages, { role: 'bot' as const, text: reply }],
          updatedAt: Date.now(),
        };
      }));
      setTyping(false);
    }, 650);
  }

  const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) ?? null : null;

  return (
    <>
      {open && <div className="chatbot-backdrop" onClick={handleClose} />}
      <div className={`chatbot-panel${open ? ' open' : ''}`}>
        {view === 'list' || !activeChat ? (
          <ChatList
            chats={chats}
            onOpen={openChat}
            onNew={startNewChat}
            onClose={handleClose}
          />
        ) : (
          <ChatDetail
            chat={activeChat}
            onBack={goBack}
            onClose={handleClose}
            onSend={send}
            typing={typing}
          />
        )}
      </div>
    </>
  );
}
