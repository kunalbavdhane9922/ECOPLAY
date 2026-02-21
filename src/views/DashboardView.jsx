import React from 'react';
import { motion } from 'framer-motion';

const islands = [
    { id: 1, name: 'Spark Island', level: 1, locked: false, top: '22%', left: '12%', img: '/assets/island1.png' },
    { id: 2, name: 'Unity Island', level: 2, locked: true, top: '42%', left: '62%', img: '/assets/island2.png' },
    { id: 3, name: 'Shield Island', level: 3, locked: true, top: '12%', left: '72%', img: '/assets/island3.png' },
    { id: 4, name: 'Thrive Island', level: 4, locked: true, top: '62%', left: '22%', img: '/assets/island4.png' },
    { id: 5, name: 'Legacy Island', level: 5, locked: true, top: '72%', left: '65%', img: '/assets/island5.png' },
];

export default function DashboardView({ onIslandClick }) {
    return (
        <div className="world-map-grid">
            <div className="world-map-header">
                <h1 className="glow-text">EcoPlay World</h1>
                <p>Choose your next environmental mission</p>
            </div>

            <svg className="path-svg">
                <path
                    d="M 180 200 C 300 180, 450 350, 650 300 S 350 550, 700 600"
                    fill="transparent"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="3"
                    strokeDasharray="12,8"
                />
            </svg>

            {islands.map((island, index) => (
                <motion.div
                    key={island.id}
                    className={`island-web ${island.locked ? 'locked' : ''}`}
                    style={{ top: island.top, left: island.left }}
                    whileHover={!island.locked ? { scale: 1.08, y: -5 } : {}}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.15, duration: 0.5 }}
                    onClick={() => !island.locked && onIslandClick(island)}
                >
                    {!island.locked && (
                        <div className="island-marker">📍</div>
                    )}
                    <div className="island-img-container">
                        <img src={island.img} alt={island.name} className="island-img" />
                    </div>
                    <div className="island-label">
                        <h3>{island.name}</h3>
                        <p>Lv. {island.level}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
