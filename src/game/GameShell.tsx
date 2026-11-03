import { useEffect, useRef, useState, useCallback } from 'react';
import { createSocket, serverUrl } from '@/lib/socket';
import type { Room, GameSnapshot, GameStartedPayload, GameEvent, MatchResult, RoomPlayer } from '@/shared/types';
import { COLORS, RANK_MARKER } from '@/shared/constants';

type GamePhase = 'landing' | 'lobby' | 'countdown' | 'racing' | 'results' | 'error';

export default function GameShell() {
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<GamePhase>('landing');
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied'>('idle');

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [started, setStarted] = useState<GameStartedPayload | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const socket = createSocket();
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('socket connected', serverUrl());
    });
    socket.on('disconnect', () => {
      console.log('socket disconnected');
    });
    socket.on('room:update', ({ room: roomData }) => {
      if (roomData) setRoom(roomData);
    });
    socket.on('game:countdown', ({ secondsLeft }) => {
      setCountdown(secondsLeft);
      setPhase('countdown');
    });
    socket.on('game:started', (startedPayload: GameStartedPayload) => {
      setStarted(startedPayload);
      setPhase('racing');
    });
    socket.on('game:snapshot', (snapshotData: GameSnapshot) => {
      setSnapshot(snapshotData);
    });
    socket.on('game:event', (event: GameEvent) => {
      setEvents((prev) => [...prev.slice(-20), event]);
    });
    socket.on('game:over', ({ results: resultsData, reason: reasonData }) => {
      setResults(resultsData);
      setReason(reasonData);
      setPhase('results');
    });
    return socket;
  }, []);

  const createRoom = useCallback(async () => {
    if (!name.trim()) {
      setError('Enter a display name.');
      return;
    }
    const socket = connect();
    if (!socket) {
      setError('Could not connect.');
      return;
    }
    return new Promise<void>((resolve) => {
      socket.emit('room:create', { name: name.trim() }, (ack: { ok: boolean; roomCode?: string; playerId?: string; sessionToken?: string; error?: string; room?: Room }) => {
        if (ack.ok && ack.roomCode && ack.playerId && ack.sessionToken && ack.room) {
          setMe(ack.playerId);
          setSessionToken(ack.sessionToken);
          setRoom(ack.room);
          setPhase('lobby');
          setError(null);
        } else {
          setError(ack.error ?? 'Could not create room.');
        }
        resolve();
      });
    });
  }, [name, connect]);

  const joinRoom = useCallback(async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      setError('Enter a valid 4-letter room code.');
      return;
    }
    if (!name.trim()) {
      setError('Enter a display name.');
      return;
    }
    const socket = connect();
    if (!socket) {
      setError('Could not connect.');
      return;
    }
    return new Promise<void>((resolve) => {
      socket.emit(
        'room:join',
        { name: name.trim(), roomCode: code, sessionToken: sessionToken ?? undefined },
        (ack: { ok: boolean; playerId?: string; sessionToken?: string; error?: string; room?: Room }) => {
          if (ack.ok && ack.playerId && ack.sessionToken && ack.room) {
            setMe(ack.playerId);
            setSessionToken(ack.sessionToken);
            setRoom(ack.room);
            setPhase('lobby');
            setError(null);
          } else {
            setError(ack.error ?? 'Could not join room.');
          }
          resolve();
        },
      );
    });
  }, [roomCodeInput, name, sessionToken, connect]);

  const leaveRoom = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !room) return;
    return new Promise<void>((resolve) => {
      socket.emit('room:leave', { roomCode: room.code }, () => {
        setRoom(null);
        setMe(null);
        setSessionToken(null);
        setPhase('landing');
        setError(null);
        resolve();
      });
    });
  }, [room]);

  const toggleReady = useCallback(async () => {
    if (!me || !room) return;
    const socket = socketRef.current;
    if (!socket) return;
    return new Promise<void>((resolve) => {
      socket.emit('player:ready', { roomCode: room.code, ready: !room.players.find((p) => p.id === me)?.ready }, () => {
        resolve();
      });
    });
  }, [me, room]);

  const startMatch = useCallback(async () => {
    if (!me || !room) return;
    const socket = socketRef.current;
    if (!socket) return;
    return new Promise<void>((resolve) => {
      socket.emit('game:start', { roomCode: room.code }, () => {
        resolve();
      });
    });
  }, [me, room]);

  const copyCode = useCallback(() => {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => {
      setCopyFeedback('copied');
      setTimeout(() => setCopyFeedback('idle'), 1500);
    }).catch(() => {
      // ignore
    });
  }, [room]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const isHost = room?.hostName === room?.players.find((p: RoomPlayer) => p.id === me)?.name;
  const presentPlayers = room?.players.filter((p: RoomPlayer) => p.connected) ?? [];
  const readyCount = presentPlayers.filter((p: RoomPlayer) => p.ready).length;
  const canStart = isHost && presentPlayers.length >= 2 && readyCount >= presentPlayers.length;

  return (
    <div className="game-shell">
      <header className="top-bar">
        <div className="brand-small">
          <span className="brand-dot" aria-hidden="true" />
          <span>Dino Race</span>
        </div>
        {phase !== 'landing' && room && (
          <div className="room-chip">
            <span className="room-code">{room.code}</span>
            <button
              type="button"
              className={`copy-btn ${copyFeedback === 'copied' ? 'copied' : ''}`}
              onClick={copyCode}
              aria-label="Copy room code"
            >
              {copyFeedback === 'copied' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        {phase !== 'landing' && (
          <button type="button" className="leave-btn" onClick={leaveRoom}>
            Leave
          </button>
        )}
      </header>

      <main className="game-main">
        {phase === 'landing' && (
          <section className="landing-card">
            <div className="name-row">
              <label className="label" htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                className="input"
                type="text"
                maxLength={18}
                placeholder="e.g. Rex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="tabs" role="tablist" aria-label="Entry mode">
              <button
                type="button"
                role="tab"
                aria-selected={true}
                className="tab"
                onClick={() => {
                  setPhase('landing');
                  setError(null);
                }}
              >
                Create room
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                className="tab"
                onClick={() => {
                  setPhase('landing');
                  setError(null);
                }}
              >
                Join room
              </button>
            </div>

            <div className="panel" role="tabpanel">
              <p className="hint">Create a room or join by 4-letter code.</p>
              <div className="join-row">
                <input
                  className="input code-input"
                  type="text"
                  maxLength={4}
                  placeholder="ABCD"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                />
                <button
                  type="button"
                  className="anyone-btn"
                  onClick={joinRoom}
                >
                  Join
                </button>
              </div>
            </div>

            {error && <div className="error" role="alert">{error}</div>}

            <div className="controls-panel">
              <h3 className="controls-heading">Controls</h3>
              <ul className="controls-list">
                <li className="control">
                  <span className="keycap">↑</span>
                  <span className="keycap">W</span>
                  <span>Jump</span>
                </li>
                <li className="control">
                  <span className="keycap">↓</span>
                  <span className="keycap">S</span>
                  <span>Crouch</span>
                </li>
                <li className="control">
                  <span className="keycap">A</span>
                  <span>Speed up (your dino)</span>
                </li>
                <li className="control">
                  <span className="keycap">D</span>
                  <span>Slow down (your dino)</span>
                </li>
              </ul>
            </div>
          </section>
        )}

        {phase === 'lobby' && room && (
          <section className="lobby-card">
            <h2 className="card-title">Lobby</h2>
            <p className="lobby-sub">
              {presentPlayers.length} / {room.players.length} present · {readyCount} ready
            </p>

            <div className="slots" role="list">
              {room.players.map((p: RoomPlayer, idx) => {
                const isMeLocal = p.id === me;
                const rank = idx + 1;
                return (
                  <div key={p.id} className="slot" role="listitem">
                    <div
                      className="slot-color"
                      style={{ backgroundColor: COLORS.players[p.colorIndex].hex }}
                    />
                    <div className="slot-rank">{RANK_MARKER.shapes[idx % RANK_MARKER.shapes.length]}</div>
                    <div className="slot-name">{p.name || '—'}</div>
                    <div className="slot-state">
                      {p.connected ? (
                        <span className="state-online">Present</span>
                      ) : (
                        <span className="state-away">Away</span>
                      )}
                    </div>
                    <div className="slot-ready">
                      <button
                        type="button"
                        className={`ready-btn ${p.ready ? 'on' : ''}`}
                        onClick={() => isMeLocal ? toggleReady() : undefined}
                        disabled={!isMeLocal}
                        aria-pressed={p.ready}
                      >
                        {p.ready ? 'Ready' : 'Ready'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {isHost && (
              <div className="host-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canStart}
                  onClick={startMatch}
                >
                  Start match
                </button>
                <p className="hint">Host can start once 2+ players are here and all present are ready.</p>
              </div>
            )}

            {!isHost && (
              <p className="hint">Waiting for host to start, or all players ready.</p>
            )}
          </section>
        )}

        {phase === 'countdown' && (
          <section className="countdown-card">
            <div className={`countdown-number ${countdown === 1 ? 'go' : ''}`}>
              {countdown === 0 ? 'GO!' : countdown}
            </div>
            <p className="countdown-label">Get ready</p>
          </section>
        )}

        {phase === 'racing' && started && snapshot && (
          <section className="race-card">
            <div className="race-bar" role="img" aria-label="Race progress">
              <div className="race-bar-track">
                <div className="race-bar-finish" />
                {snapshot.players.map((p: { id: string; name: string; colorIndex: number; distance: number; eliminated: boolean; finished: boolean }, idx) => {
                  const myP = p.id === me;
                  const marker = RANK_MARKER.shapes[idx % RANK_MARKER.shapes.length];
                  const progress = Math.min(1, p.distance / started.trackLengthMeters);
                  return (
                    <div
                      key={p.id}
                      className={`race-bar-lane ${myP ? 'mine' : ''} ${p.eliminated ? 'out' : ''} lane-${p.colorIndex}`}
                    >
                      <div className="race-bar-marker">
                        <span className="race-bar-rank">{marker}</span>
                        <span className="race-bar-name">{p.name}</span>
                        {p.eliminated && <span className="race-bar-out">OUT</span>}
                        {p.finished && <span className="race-bar-fin">FIN</span>}
                      </div>
                      <div
                        className="race-bar-fill"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="playfield">
              <canvas
                ref={canvasRef}
                className="playfield-canvas"
                width={800}
                height={300}
                aria-hidden="true"
              />
              <div className="hud-bottom">
                <div className="hud-lives" aria-label="Your lives">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={`heart ${i < 3 ? 'full' : ''}`} />
                  ))}
                </div>
                <div className="hud-speed" aria-label="Your speed">
                  <span className="speed-value">1.00×</span>
                  <div className="speed-gauge">
                    <div className="speed-gauge-fill" />
                  </div>
                  <div className="speed-hint">
                    <span className="keycap">A</span> speed up
                    <span className="keycap">D</span> slow
                  </div>
                </div>
              </div>
            </div>

            <div className="race-timer">
              {started.maxDurationSeconds}
            </div>
          </section>
        )}

        {phase === 'results' && results && (
          <section className="results-card">
            <h2 className="card-title">Results</h2>
            {reason && <p className="results-reason">Match ended: {reason}</p>}
            <ol className="results-list">
              {results.map((r) => (
                <li key={r.name + r.placement} className="result-row">
                  <span className="result-place">#{r.placement}</span>
                  <span className="result-name">{r.name}</span>
                  <span className="result-dist">{r.distance.toFixed(1)} m</span>
                  <span className="result-lives">{r.livesRemaining} lives</span>
                  {r.finishTimeMs !== null && (
                    <span className="result-time">{r.finishTimeMs.toFixed(0)} ms</span>
                  )}
                  {r.eliminated && <span className="result-elim">OUT</span>}
                </li>
              ))}
            </ol>
            <div className="results-actions">
              <button type="button" className="primary-btn" onClick={leaveRoom}>
                Leave
              </button>
            </div>
          </section>
        )}

        {phase === 'error' && error && (
          <section className="error-card">
            <p className="error" role="alert">{error}</p>
            <button type="button" className="primary-btn" onClick={() => setPhase('landing')}>
              Back
            </button>
          </section>
        )}
      </main>

      <footer className="game-footer">
        <span className="desktop-notice">Best on desktop — keyboard controls, desktop-first.</span>
      </footer>
    </div>
  );
}
