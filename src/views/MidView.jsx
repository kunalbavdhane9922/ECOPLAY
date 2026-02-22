import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Trophy, Map as MapIcon, ChevronRight, Activity, Zap, MapPin, Users, ClipboardList } from "lucide-react";
import "./MidView.css";

function MidView({ onBack }) {
  const [activePanel, setActivePanel] = useState(null);

  const recommendedTasks = [
    { id: 1, title: "Plant 5 Saplings", reward: "500 XP", icon: <Zap size={14} /> },
    { id: 2, title: "Report Waste Site", reward: "200 XP", icon: <Activity size={14} /> },
    { id: 3, title: "Morning Walk 2km", reward: "100 XP", icon: <Zap size={14} /> },
  ];

  const clanInfo = {
    name: "Eco Warriors",
    rank: "#12 Global",
    members: 45,
    totalXp: "125,400",
  };

  const togglePanel = (e, panel) => {
    e.stopPropagation();
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="midview-container"
      style={{ backgroundImage: 'url("/assets/island2.2.png")' }}
      onClick={() => setActivePanel(null)}
    >
      <div className="hud-overlay">
        <header className="hud-header">
          <div style={{ display: 'flex', gap: '12px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="profile-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <User size={20} />
              <span>PROFILE</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="profile-btn"
              style={{ borderColor: activePanel === 'tasks' ? '#00f2ff' : 'rgba(0, 242, 255, 0.3)', background: activePanel === 'tasks' ? 'rgba(0, 242, 255, 0.2)' : '' }}
              onClick={(e) => togglePanel(e, 'tasks')}
            >
              <ClipboardList size={20} />
              <span>MISSIONS</span>
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rewards-btn"
            onClick={(e) => e.stopPropagation()}
          >
            <Trophy size={20} />
            <span>REWARDS</span>
          </motion.button>
        </header>

        {/* Interactive Island Pins */}
        <div className="pins-container">
          {/* Pin 1: Recommended Tasks */}
          <motion.div
            className="island-pin"
            style={{ top: '45%', left: '65%' }}
            onClick={(e) => togglePanel(e, "tasks")}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="pin-marker" style={{ borderColor: '#00f2ff' }}>
              <ClipboardList size={18} />
            </div>
            <div className="pin-label">Missions</div>
          </motion.div>

          {/* Pin 2: View on Map */}
          <motion.div
            className="island-pin"
            style={{ top: '40%', left: '35%' }}
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <div className="pin-marker" style={{ borderColor: '#00f2ff' }}>
              <MapIcon size={18} />
            </div>
            <div className="pin-label">World Map</div>
          </motion.div>

          {/* Pin 3: View Clan */}
          <motion.div
            className="island-pin"
            style={{ top: '65%', left: '50%' }}
            onClick={(e) => togglePanel(e, "clan")}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <div className="pin-marker" style={{ borderColor: '#ff00ea' }}>
              <Users size={18} />
            </div>
            <div className="pin-label">Clan HUB</div>
          </motion.div>
        </div>

        <div className="main-content-layout">
          <div className="side-container">
            <AnimatePresence>
              {activePanel === "tasks" && (
                <motion.section
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 300, opacity: 0 }}
                  className="right-tasks"
                >
                  <div className="tasks-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="mission-image-container" style={{
                      width: '100%',
                      height: '120px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      marginBottom: '15px',
                      border: '1px solid rgba(0, 242, 255, 0.3)'
                    }}>
                      <img
                        src="/assets/island1.1.png"
                        alt="Mission"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <h3>Recommended Tasks</h3>
                    <div className="task-list">
                      {recommendedTasks.map((task) => (
                        <div key={task.id} className="task-item">
                          <div className="task-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{task.title}</span>
                            <span style={{ color: '#ff9d00', fontWeight: 'bold' }}>{task.reward}</span>
                          </div>
                          <div style={{ opacity: 0.6, fontSize: '10px', marginTop: '4px' }}>
                            QUICK ACTION
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          <div className="side-container">
            <AnimatePresence>
              {activePanel === "clan" && (
                <motion.section
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  className="left-clan"
                >
                  <div className="clan-panel" onClick={(e) => e.stopPropagation()}>
                    <h3>Clan Summary</h3>
                    <div className="clan-stats">
                      <div className="stat-row">
                        <span>Name</span>
                        <span style={{ color: '#ff00ea' }}>{clanInfo.name}</span>
                      </div>
                      <div className="stat-row">
                        <span>Rank</span>
                        <span style={{ color: '#00f2ff' }}>{clanInfo.rank}</span>
                      </div>
                      <div className="stat-row">
                        <span>Members</span>
                        <span>{clanInfo.members}/50</span>
                      </div>
                      <div className="stat-row">
                        <span>Total XP</span>
                        <span style={{ color: '#ff9d00' }}>{clanInfo.totalXp}</span>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="bottom-info-bar" onClick={(e) => e.stopPropagation()}>
          <div className="mission-title">
            MISSION OVERVIEW // SELECT PIN TO NAVIGATE
          </div>
        </footer>
      </div>
    </motion.div>
  );
}

export default MidView;