import React, { useEffect, useMemo, useRef, useState } from "react";

const formats = {
  oxford: {
    name: "Modified Oxford",
    description: "Four speeches and two reply speeches",
    roles: [
      { id: "prop-1", label: "First Proposition", team: "Proposition", kind: "speaker" },
      { id: "opp-1", label: "First Opposition", team: "Opposition", kind: "speaker" },
      { id: "prop-2", label: "Second Proposition", team: "Proposition", kind: "speaker" },
      { id: "opp-2", label: "Second Opposition", team: "Opposition", kind: "speaker" },
      { id: "opp-reply", label: "Opposition Reply", team: "Opposition", kind: "reply" },
      { id: "prop-reply", label: "Proposition Reply", team: "Proposition", kind: "reply" },
    ],
    durations: { speaker: 300, reply: 180, poi: 15, grace: 30 },
  },
  asian: {
    name: "Asian Parliamentary",
    description: "Six speeches and two reply speeches · POIs open from 1:00 to 6:00",
    roles: [
      { id: "pm", label: "Prime Minister", team: "Government", kind: "speaker", poi: true },
      { id: "lo", label: "Leader of Opposition", team: "Opposition", kind: "speaker", poi: true },
      { id: "dpm", label: "Deputy Prime Minister", team: "Government", kind: "speaker", poi: true },
      { id: "dlo", label: "Deputy Leader of Opposition", team: "Opposition", kind: "speaker", poi: true },
      { id: "gw", label: "Government Whip", team: "Government", kind: "speaker" },
      { id: "ow", label: "Opposition Whip", team: "Opposition", kind: "speaker" },
      { id: "opp-reply", label: "Opposition Reply", team: "Opposition", kind: "reply" },
      { id: "gov-reply", label: "Government Reply", team: "Government", kind: "reply" },
    ],
    durations: { speaker: 300, reply: 180, poi: 15, grace: 30 },
  },
};

const timerKinds = [
  { id: "speaker", label: "Speaker time" },
  { id: "reply", label: "Reply" },
  { id: "poi", label: "Point of Information" },
];

const settingKinds = [
  ...timerKinds,
  { id: "grace", label: "Grace period" },
];

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

const toMinutes = (seconds) => Math.floor(seconds / 60);
const toSeconds = (seconds) => seconds % 60;
const getTotalDurationMs = (kind, durations) =>
  (durations[kind] + durations.grace) * 1000;

function App() {
  const [formatId, setFormatId] = useState("asian");
  const [durationsByFormat, setDurationsByFormat] = useState(() =>
    Object.fromEntries(
      Object.entries(formats).map(([id, format]) => [id, { ...format.durations }]),
    ),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerKind, setTimerKind] = useState("speaker");
  const [remainingMs, setRemainingMs] = useState(getTotalDurationMs("speaker", formats.asian.durations));
  const [deadline, setDeadline] = useState(null);
  const [running, setRunning] = useState(false);
  const [poiTimerActive, setPoiTimerActive] = useState(false);
  const [poiTimerRunning, setPoiTimerRunning] = useState(false);
  const [poiRemainingMs, setPoiRemainingMs] = useState(0);
  const [poiDeadline, setPoiDeadline] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playedDings = useRef(new Set());
  const playedPoiDings = useRef(new Set());
  const audioContext = useRef(null);

  const format = formats[formatId];
  const roles = format.roles;
  const activeRole = roles[activeIndex];
  const durations = durationsByFormat[formatId];
  const durationMs = durations[timerKind] * 1000;
  const totalDurationMs = getTotalDurationMs(timerKind, durations);

  const resetDings = () => {
    playedDings.current = new Set();
  };

  const prepareAudio = async () => {
    if (!window.AudioContext) {
      console.error("Web Audio is not supported in this browser.");
      return false;
    }
    if (!audioContext.current) audioContext.current = new window.AudioContext();
    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume().catch((error) => {
        console.error("Could not enable timer sounds.", error);
      });
    }
    return audioContext.current.state === "running";
  };

  const playDingSound = (count) => {
    if (!audioContext.current || audioContext.current.state !== "running") return;

    for (let index = 0; index < count; index += 1) {
      const startAt = audioContext.current.currentTime + index * 0.28;
      const bellModes = [
        { frequency: 1174.66, volume: 0.12, decay: 1.15 },
        { frequency: 2819.18, volume: 0.2, decay: 0.78 },
        { frequency: 4816.1, volume: 0.1, decay: 0.52 },
        { frequency: 6337.16, volume: 0.065, decay: 0.38 },
        { frequency: 7987.69, volume: 0.035, decay: 0.28 },
      ];

      bellModes.forEach(({ frequency, volume, decay }) => {
        const oscillator = audioContext.current.createOscillator();
        const gain = audioContext.current.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + decay);
        oscillator.connect(gain);
        gain.connect(audioContext.current.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + decay + 0.01);
      });
    }
  };

  const playDing = (milestone, count) => {
    if (playedDings.current.has(milestone)) return;
    playedDings.current.add(milestone);
    playDingSound(count);
  };

  useEffect(() => {
    if (!running || deadline === null) return undefined;

    const updateRemaining = () => {
      const nextRemaining = Math.max(0, deadline - Date.now());
      const elapsedMs = totalDurationMs - nextRemaining;
      setRemainingMs(nextRemaining);
      if (durationMs > 60_000 && elapsedMs >= 60_000) {
        playDing("first-minute", 1);
      }
      if (elapsedMs >= durationMs) {
        playDing("speech-end", 1);
      }
      if (timerKind !== "poi" && elapsedMs >= totalDurationMs) {
        playDing("grace-end", 2);
      }
      if (nextRemaining === 0) {
        setRunning(false);
        setDeadline(null);
      }
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 100);
    return () => window.clearInterval(intervalId);
  }, [running, deadline, durationMs, totalDurationMs, timerKind]);

  useEffect(() => {
    if (!poiTimerRunning || poiDeadline === null) return undefined;

    const updatePoiRemaining = () => {
      const nextRemaining = Math.max(0, poiDeadline - Date.now());
      setPoiRemainingMs(nextRemaining);
      if (nextRemaining === 0) {
        setPoiTimerRunning(false);
        setPoiDeadline(null);
        if (!playedPoiDings.current.has("poi-end")) {
          playedPoiDings.current.add("poi-end");
          playDingSound(1);
        }
      }
    };

    updatePoiRemaining();
    const intervalId = window.setInterval(updatePoiRemaining, 50);
    return () => window.clearInterval(intervalId);
  }, [poiTimerRunning, poiDeadline]);

  const progress = useMemo(() => {
    if (totalDurationMs <= 0) return 0;
    return Math.min(100, Math.max(0, (remainingMs / totalDurationMs) * 100));
  }, [totalDurationMs, remainingMs]);

  const selectFormat = (nextFormatId) => {
    const nextRole = formats[nextFormatId].roles[0];
    setRunning(false);
    setDeadline(null);
    setFormatId(nextFormatId);
    setActiveIndex(0);
    setTimerKind(nextRole.kind);
    setPoiTimerActive(false);
    setPoiTimerRunning(false);
    setPoiDeadline(null);
    resetDings();
    setRemainingMs(getTotalDurationMs(nextRole.kind, durationsByFormat[nextFormatId]));
  };

  const updateDuration = (kind, field, value) => {
    if (value === "") return;
    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) return;
    const nextValue = Math.min(parsedValue, field === "seconds" ? 59 : 99);
    const currentSeconds = durations[kind];
    const nextSeconds = field === "minutes"
      ? nextValue * 60 + toSeconds(currentSeconds)
      : toMinutes(currentSeconds) * 60 + nextValue;

    const nextDurations = { ...durations, [kind]: nextSeconds };
    setDurationsByFormat((current) => ({
      ...current,
      [formatId]: nextDurations,
    }));

    if (!running && (timerKind === kind || (kind === "grace" && timerKind !== "poi"))) {
      resetDings();
      setRemainingMs(getTotalDurationMs(timerKind, nextDurations));
    }
  };

  const startPoiTimer = () => {
    void prepareAudio();
    playedPoiDings.current = new Set();
    const poiDurationMs = durations.poi * 1000;
    setPoiTimerActive(true);
    setPoiRemainingMs(poiDurationMs);
    setPoiDeadline(Date.now() + poiDurationMs);
    setPoiTimerRunning(true);
  };

  const startOrPause = () => {
    if (running) {
      setRunning(false);
      setDeadline(null);
      return;
    }
    void prepareAudio();
    const startFrom = remainingMs > 0 ? remainingMs : totalDurationMs;
    if (remainingMs === 0) resetDings();
    setRemainingMs(startFrom);
    setDeadline(Date.now() + startFrom);
    setRunning(true);
  };

  const resetTimer = () => {
    setRunning(false);
    setDeadline(null);
    resetDings();
    setRemainingMs(totalDurationMs);
  };

  const goToSpeaker = (index) => {
    const nextIndex = (index + roles.length) % roles.length;
    const nextRole = roles[nextIndex];
    setRunning(false);
    setDeadline(null);
    setActiveIndex(nextIndex);
    setTimerKind(nextRole.kind);
    setPoiTimerActive(false);
    setPoiTimerRunning(false);
    setPoiDeadline(null);
    resetDings();
    setRemainingMs(getTotalDurationMs(nextRole.kind, durations));
  };

  const timerComplete = remainingMs === 0;
  const elapsedMs = totalDurationMs - remainingMs;
  const inGrace = timerKind !== "poi" && elapsedMs >= durationMs && remainingMs > 0;
  const poiDurationMs = durations.poi * 1000;
  const poiProgress = poiDurationMs > 0 ? poiRemainingMs / poiDurationMs : 0;
  const clockRemainingMs = timerKind === "poi" || inGrace
    ? remainingMs
    : Math.max(0, remainingMs - durations.grace * 1000);
  const poiWindowOpen =
    formatId === "asian" &&
    timerKind === "speaker" &&
    activeRole.poi &&
    elapsedMs >= 60_000 &&
    elapsedMs < durationMs - 60_000 &&
    running;

  return (
    <main className="app-shell container-fluid p-0">
      <header className="topbar d-flex justify-content-between align-items-center">
        <a className="brand" href="#" aria-label="Debate Timer home">DEBATE TIMER by VIN</a>
        <button
          className="settings-toggle btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open debate settings"
          title="Debate settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
          </svg>
        </button>
      </header>

      <section className="debate-layout row g-4 align-items-center" aria-label={`${format.name} debate timer`}>
        <div className="timer-area col-12 col-lg-8">
          <div className="current-speaker">
            <h1>{timerKind === "poi" ? "POINT OF INFORMATION" : activeRole.label}</h1>
          </div>

          <div className={`clock ${timerComplete ? "finished" : ""} ${running ? "is-running" : ""}`}>
            {formatDuration(clockRemainingMs)}
          </div>
          <div className="progress-track" aria-label={`${Math.round(progress)}% total time remaining`}>
            <span className={inGrace ? "grace-progress" : ""} style={{ width: `${progress}%` }} />
          </div>
          <div className="timer-caption">
            <span>{timerComplete ? "TIME IS UP" : inGrace ? "GRACE PERIOD" : "TIME REMAINING"}</span>
            <span>{formatDuration(durationMs)}{durations.grace > 0 ? ` + ${formatDuration(durations.grace * 1000)}` : ""}</span>
          </div>
          {poiTimerActive && (
            <div className={`poi-bar ${poiTimerRunning ? "is-running" : "finished"}`}>
              <div className="poi-bar-heading">
                <span>POINT OF INFORMATION</span>
                <strong role="timer" aria-label={`${formatDuration(poiRemainingMs)} remaining`}>
                  {formatDuration(poiRemainingMs)}
                </strong>
              </div>
              <div className="progress-track poi-progress-track" aria-label={`${Math.round(poiProgress * 100)}% POI time remaining`}>
                <span style={{ width: `${poiProgress * 100}%` }} />
              </div>
            </div>
          )}

          <div className="timer-controls">
            <button className="btn start-button" onClick={startOrPause}>
              {running ? "PAUSE TIMER" : timerComplete ? "START AGAIN" : "START TIMER"}
            </button>
            <button className="btn control-button" onClick={resetTimer} aria-label="Reset timer" title="Reset timer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <button className="btn control-button" onClick={() => goToSpeaker(activeIndex + 1)} aria-label="Next speaker" title="Next speaker">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </button>
            <button
              className={`btn poi-button ${poiTimerRunning ? "selected" : ""}`}
              onClick={startPoiTimer}
              aria-pressed={poiTimerRunning}
            >
              POI
            </button>
          </div>

          <div className={`poi-window ${poiWindowOpen ? "open" : ""}`}>
            {formatId === "asian" && activeRole.poi
              ? poiWindowOpen ? "POINTS OF INFORMATION OPEN" : "POINTS OF INFORMATION: 1:00 — 1:00 LEFT"
              : format.name.toUpperCase()}
          </div>
        </div>

        <aside className="lineup-panel col-12 col-lg-4" aria-label="Speaker lineup">
          <div className="lineup-list">
            {roles.map((role, index) => (
              <button
                className={`role-row team-${role.team.toLowerCase()} ${index === activeIndex ? "active" : ""}`}
                key={role.id}
                onClick={() => goToSpeaker(index)}
                aria-label={`Select ${role.label}`}
                aria-pressed={index === activeIndex}
                title={`${role.label} · ${formatDuration(durations[role.kind] * 1000)}`}
              >
                <span className="speaker-avatar" aria-hidden="true">
                  <svg viewBox="0 0 32 32">
                    <circle cx="16" cy="11" r="5" />
                    <path d="M6.5 27c.5-5.3 4.2-8.5 9.5-8.5s9 3.2 9.5 8.5" />
                  </svg>
                </span>
                <span className="role-details">
                  <strong>{role.label}</strong>
                  <small>{role.team} · {formatDuration(durations[role.kind] * 1000)}</small>
                </span>
                {index === activeIndex && <span className="active-marker" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </aside>
      </section>

      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="settings-dialog card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-dialog-header">
              <div>
                <span className="settings-kicker">DEBATE TIMER</span>
                <h2 id="settings-title">Settings</h2>
              </div>
              <button className="btn settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <span className="settings-section-title">FORMAT</span>
            <div className="settings-format-list">
              {Object.entries(formats).map(([id, item]) => (
                <button
                  className={`btn settings-format ${formatId === id ? "selected" : ""}`}
                  key={id}
                  onClick={() => selectFormat(id)}
                  aria-pressed={formatId === id}
                >
                  <span>{item.name}</span>
                  <span className="format-selection">{formatId === id ? "✓" : ""}</span>
                </button>
              ))}
            </div>
            <span className="settings-section-title">SOUND</span>
            <button
              className="btn test-sound-button"
              onClick={() => {
                void prepareAudio().then((ready) => {
                  if (ready) playDingSound(1);
                });
              }}
            >
              Test bell sound
            </button>
            <span className="settings-section-title">TIMING</span>
            <div className="settings-list">
              {settingKinds.map(({ id, label }, index) => (
                <div className="setting-row" key={id}>
                  <div className="setting-name">
                    <div>
                      <strong>{label}</strong>
                      {id === "grace" && <small className="setting-hint">Applies to speeches, not POI timers</small>}
                    </div>
                  </div>
                  <div className="duration-editor" aria-label={`${label} duration`}>
                    <label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="0"
                        max="99"
                        value={toMinutes(durations[id])}
                        disabled={running || poiTimerRunning}
                        onChange={(event) => updateDuration(id, "minutes", event.target.value)}
                        aria-label={`${label} minutes`}
                      />
                      <span>m</span>
                    </label>
                    <span className="time-colon">:</span>
                    <label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="0"
                        max="59"
                        value={toSeconds(durations[id])}
                        disabled={running || poiTimerRunning}
                        onChange={(event) => updateDuration(id, "seconds", event.target.value)}
                        aria-label={`${label} seconds`}
                      />
                      <span>s</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <p className="settings-note">Timing values apply to every matching speech. Pause the timer to edit timings.</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
