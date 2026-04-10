import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaComments, FaPaperPlane, FaUserPlus, FaUsers } from 'react-icons/fa';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import '../styles/TeamChat.css';

export default function TeamChat() {
  const { user } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [typingPeer, setTypingPeer] = useState(null);
  const [showTeammates, setShowTeammates] = useState(false);

  const orgId = user?.organization?._id || user?.organization;
  const myUserId = user?._id != null ? String(user._id) : user?.id != null ? String(user.id) : '';

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ['chat-conversations', orgId],
    queryFn: async () => {
      const { data } = await api.get('/chat/conversations');
      return data.data || [];
    },
    enabled: Boolean(orgId)
  });

  const { data: teammates = [] } = useQuery({
    queryKey: ['chat-teammates', orgId],
    queryFn: async () => {
      const { data } = await api.get('/chat/teammates');
      return data.data || [];
    },
    enabled: Boolean(orgId) && showTeammates
  });

  const {
    data: messagesData,
    isLoading: loadingMessages,
  } = useQuery({
    queryKey: ['chat-messages', selectedId],
    queryFn: async () => {
      const { data } = await api.get(`/chat/conversations/${selectedId}/messages?limit=80`);
      return data.data || [];
    },
    enabled: Boolean(selectedId)
  });

  const [liveMessages, setLiveMessages] = useState([]);

  useEffect(() => {
    setLiveMessages([]);
  }, [selectedId]);

  useEffect(() => {
    if (Array.isArray(messagesData)) {
      setLiveMessages(messagesData);
    }
  }, [messagesData]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [liveMessages, scrollToBottom]);

  useEffect(() => {
    if (!socket || !selectedId) return;

    const onMessage = (payload) => {
      if (!payload?.conversationId || String(payload.conversationId) !== String(selectedId)) return;
      const msg = payload.message;
      if (!msg?._id) return;
      setLiveMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations', orgId] });
    };

    const onTyping = (payload) => {
      if (!payload?.conversationId || String(payload.conversationId) !== String(selectedId)) return;
      if (String(payload.userId) === myUserId) return;
      if (payload.typing) {
        setTypingPeer(payload.userName || 'Someone');
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingPeer(null), 2500);
      } else {
        setTypingPeer(null);
      }
    };

    const doJoin = () => {
      socket.emit('joinChat', selectedId, (res) => {
        if (res?.error) console.warn('joinChat:', res.error);
      });
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('connect', doJoin);
    doJoin();

    return () => {
      socket.emit('leaveChat', selectedId);
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('connect', doJoin);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, selectedId, orgId, queryClient, myUserId]);

  useEffect(() => {
    if (!conversations.length || selectedId) return;
    const team = conversations.find((c) => c.kind === 'team');
    if (team) setSelectedId(team._id);
    else setSelectedId(conversations[0]._id);
  }, [conversations, selectedId]);

  const sendMutation = useMutation({
    mutationFn: async (text) => {
      const { data } = await api.post(`/chat/conversations/${selectedId}/messages`, { text });
      return data.data;
    },
    onSuccess: (msg) => {
      if (socket && selectedId) {
        socket.emit('chat:typing', { conversationId: selectedId, typing: false });
      }
      if (msg?._id) {
        setLiveMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
      queryClient.invalidateQueries({ queryKey: ['chat-conversations', orgId] });
      setDraft('');
      scrollToBottom();
    },
    onError: (err) => {
      console.error(err);
      window.alert(err.response?.data?.message || 'Failed to send message');
    }
  });

  const openDirectMutation = useMutation({
    mutationFn: async (userId) => {
      const { data } = await api.post(`/chat/conversations/direct/${userId}`);
      return data.data;
    },
    onSuccess: (conv) => {
      setShowTeammates(false);
      queryClient.invalidateQueries({ queryKey: ['chat-conversations', orgId] });
      if (conv?._id) setSelectedId(conv._id);
    },
    onError: (err) => {
      window.alert(err.response?.data?.message || 'Could not open conversation');
    }
  });

  const selected = useMemo(
    () => conversations.find((c) => c._id === selectedId),
    [conversations, selectedId]
  );

  const handleSend = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedId || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  const handleTyping = (v) => {
    setDraft(v);
    if (!socket || !selectedId) return;
    socket.emit('chat:typing', { conversationId: selectedId, typing: v.length > 0 });
  };

  if (!orgId) {
    return (
      <div className="team-chat-page">
        <div className="team-chat-empty">
          <FaComments size={48} />
          <h2>Team chat</h2>
          <p>Join an organization to message your team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-chat-page">
      <div className="team-chat-shell card">
        <aside className="team-chat-sidebar">
          <div className="team-chat-sidebar-head">
            <h2>
              <FaComments /> Chat
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-secondary team-chat-new-dm"
              onClick={() => setShowTeammates(true)}
              title="Message a teammate"
            >
              <FaUserPlus /> New
            </button>
          </div>
          {loadingConvs ? (
            <p className="team-chat-muted">Loading…</p>
          ) : (
            <ul className="team-chat-conv-list">
              {conversations.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    className={`team-chat-conv-item ${c._id === selectedId ? 'active' : ''}`}
                    onClick={() => setSelectedId(c._id)}
                  >
                    <span className="team-chat-conv-icon">
                      {c.kind === 'team' ? <FaUsers /> : <FaComments />}
                    </span>
                    <span className="team-chat-conv-meta">
                      <span className="team-chat-conv-title">{c.title || (c.kind === 'team' ? 'Team' : 'Direct')}</span>
                      {c.lastMessage?.text ? (
                        <span className="team-chat-conv-preview">{c.lastMessage.text}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="team-chat-main">
          {!selectedId ? (
            <div className="team-chat-empty-main">Select a conversation</div>
          ) : (
            <>
              <header className="team-chat-header">
                <h3>{selected?.title || (selected?.kind === 'team' ? 'Team' : 'Direct message')}</h3>
                {selected?.kind === 'direct' && selected?.peer?.email && (
                  <span className="team-chat-muted">{selected.peer.email}</span>
                )}
              </header>
              <div className="team-chat-messages">
                {loadingMessages && liveMessages.length === 0 ? (
                  <p className="team-chat-muted">Loading messages…</p>
                ) : (
                  liveMessages.map((m) => {
                    const sid = m.sender?._id != null ? String(m.sender._id) : m.sender?.id != null ? String(m.sender.id) : '';
                    const mine = sid && sid === myUserId;
                    return (
                      <div key={m._id} className={`team-chat-bubble-wrap ${mine ? 'mine' : ''}`}>
                        <div className="team-chat-bubble">
                          {!mine && (
                            <span className="team-chat-bubble-name">{m.sender?.name || 'User'}</span>
                          )}
                          <p className="team-chat-bubble-text">{m.text}</p>
                          <time className="team-chat-bubble-time">
                            {m.createdAt
                              ? new Date(m.createdAt).toLocaleString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: 'numeric',
                                  month: 'short'
                                })
                              : ''}
                          </time>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              {typingPeer ? <div className="team-chat-typing">{typingPeer} is typing…</div> : null}
              <form className="team-chat-composer" onSubmit={handleSend}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Write a message…"
                  value={draft}
                  onChange={(e) => handleTyping(e.target.value)}
                  maxLength={4000}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!draft.trim() || sendMutation.isPending}
                >
                  <FaPaperPlane /> Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {showTeammates && (
        <div className="team-chat-modal-backdrop" role="presentation" onClick={() => setShowTeammates(false)}>
          <div className="team-chat-modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Message a teammate</h3>
            <ul className="team-chat-teammate-list">
              {teammates.length === 0 ? (
                <li className="team-chat-muted">No other members in this organization.</li>
              ) : (
                teammates.map((t) => (
                  <li key={t._id}>
                    <button
                      type="button"
                      className="team-chat-teammate-btn"
                      onClick={() => openDirectMutation.mutate(t._id)}
                      disabled={openDirectMutation.isPending}
                    >
                      <span className="team-chat-teammate-avatar">{t.name?.charAt(0)?.toUpperCase() || '?'}</span>
                      <span>
                        <strong>{t.name}</strong>
                        <small className="team-chat-muted">{t.email}</small>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button type="button" className="btn btn-secondary" onClick={() => setShowTeammates(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
