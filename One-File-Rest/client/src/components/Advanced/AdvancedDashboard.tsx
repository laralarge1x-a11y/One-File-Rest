import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './AdvancedDashboard.css';

interface DashboardMetric {
  label: string;
  value: string | number;
  change: number;
  icon: string;
  color: string;
}

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

const AdvancedDashboard: React.FC = () => {
  const [metrics] = useState<DashboardMetric[]>([
    { label: 'Active Cases', value: 24, change: 12, icon: '📋', color: '#3498db' },
    { label: 'Won Appeals', value: 18, change: 8, icon: '✅', color: '#2ecc71' },
    { label: 'Pending Reviews', value: 7, change: -3, icon: '⏳', color: '#f39c12' },
    { label: 'Success Rate', value: '75%', change: 5, icon: '📈', color: '#9b59b6' },
  ]);

  const [chartData] = useState<ChartData[]>([
    { name: 'Week 1', cases: 4, won: 2, denied: 1 },
    { name: 'Week 2', cases: 6, won: 4, denied: 1 },
    { name: 'Week 3', cases: 5, won: 3, denied: 2 },
    { name: 'Week 4', cases: 8, won: 6, denied: 1 },
    { name: 'Week 5', cases: 7, won: 5, denied: 2 },
  ]);

  const [pieData] = useState([
    { name: 'Won', value: 45, color: '#2ecc71' },
    { name: 'Pending', value: 35, color: '#f39c12' },
    { name: 'Denied', value: 20, color: '#e74c3c' },
  ]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <motion.div
      className="advanced-dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="dashboard-header" variants={itemVariants}>
        <h1>Dashboard</h1>
        <p>Real-time case management & analytics</p>
      </motion.div>

      <motion.div className="metrics-grid" variants={containerVariants}>
        {metrics.map((metric, idx) => (
          <motion.div
            key={idx}
            className="metric-card"
            variants={itemVariants}
            whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
          >
            <div className="metric-icon">{metric.icon}</div>
            <div className="metric-content">
              <p className="metric-label">{metric.label}</p>
              <h3 className="metric-value">{metric.value}</h3>
              <span className={`metric-change ${metric.change >= 0 ? 'positive' : 'negative'}`}>
                {metric.change >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
              </span>
            </div>
            <div className="metric-bar" style={{ backgroundColor: metric.color }}></div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="charts-section" variants={containerVariants}>
        <motion.div className="chart-container" variants={itemVariants}>
          <h2>Case Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="cases" stroke="#3498db" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="won" stroke="#2ecc71" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="denied" stroke="#e74c3c" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="chart-container" variants={itemVariants}>
          <h2>Appeal Success Rate</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="won" fill="#2ecc71" stroke="#27ae60" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="chart-container pie-container" variants={itemVariants}>
          <h2>Case Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="chart-container" variants={itemVariants}>
          <h2>Weekly Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="cases" fill="#3498db" radius={[8, 8, 0, 0]} />
              <Bar dataKey="won" fill="#2ecc71" radius={[8, 8, 0, 0]} />
              <Bar dataKey="denied" fill="#e74c3c" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>

      <motion.div className="recent-activity" variants={itemVariants}>
        <h2>Recent Activity</h2>
        <div className="activity-list">
          {[1, 2, 3, 4, 5].map((item) => (
            <motion.div key={item} className="activity-item" whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
              <div className="activity-dot"></div>
              <div className="activity-content">
                <p className="activity-title">Case #{1000 + item} Status Updated</p>
                <p className="activity-time">2 hours ago</p>
              </div>
              <span className="activity-badge">Appeal Submitted</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdvancedDashboard;
