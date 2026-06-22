import React, { useState, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [gameState, setGameState] = useState({
    name: "김유현", rank: "C", level: 15, title: "초보 헌터", gold: 5000,
    stats: { STR: { val: 12, xp: 45, next: 100 }, INT: { val: 10, xp: 80, next: 100 } },
    hasGoal: true
  });
  const timerRef = useRef(null);

  const clearHold = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleRefine = (key) => {
    setGameState(prev => {
      const s = prev.stats[key];
      if (prev.gold < 10) return prev;
      let nXp = s.xp + 2; let nVal = s.val;
      if (nXp >= s.next) { nXp = 0; nVal += 1; }
      return { ...prev, gold: prev.gold - 10, stats: { ...prev.stats, [key]: { ...s, xp: nXp, val: nVal } } };
    });
  };

  const startHold = (key) => { clearHold(); handleRefine(key); timerRef.current = setInterval(() => handleRefine(key), 80); };

  return (
    <div className={`app-container rank-${gameState.rank.toLowerCase()}`}>
      <div className="hunter-card">
        <div className="card-inner">
          <div className="avatar-section">👤</div>
          <div className="info-section">
            <div className="title-row">
              <span className="hunter-title">[{gameState.title}]</span>
              <span className={`rank-badge rank-${gameState.rank.toLowerCase()}`}>{gameState.rank}</span>
            </div>
            <h2 className="hunter-name">{gameState.name} <small>Lv.{gameState.level}</small></h2>
            <div className="stats-container">
              {Object.entries(gameState.stats).map(([key, s]) => (
                <div key={key} className="stat-row">
                  <div className="stat-info">
                    <span>{key} {s.val}</span>
                    <button className="refine-btn" onPointerDown={() => startHold(key)} onPointerUp={clearHold} onPointerLeave={clearHold}>연마</button>
                  </div>
                  <div className="progress-bg">
                    <div className="progress-fill" style={{ width: `${(s.xp/s.next)*100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <button className="main-cta">{gameState.hasGoal ? "게이트 진입" : "목표 추가"}</button>
    </div>
  );
}

export default App;
