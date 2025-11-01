"use client";

import { useState } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  description?: string; // Descrizione dell'indicatore per il tooltip
}

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'blue',
  description,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    green: 'bg-green-500/20 border-green-500/50 text-green-300',
    red: 'bg-red-500/20 border-red-500/50 text-red-300',
    yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    purple: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-2xl p-6 ${colorClasses[color]} relative`}>
      <div className="flex items-start justify-between mb-4">
        <div 
          className={`p-3 rounded-lg ${colorClasses[color]} relative cursor-help group`}
          onMouseEnter={() => description && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => description && setShowTooltip(!showTooltip)}
        >
          {icon}
          {description && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {description && showTooltip && (
            <div className="absolute z-50 left-full ml-3 top-0 w-80 p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl text-white text-sm leading-relaxed pointer-events-none">
              <div className="font-semibold text-base mb-2 text-gray-200">{title}</div>
              <div className="text-gray-300">{description}</div>
              <div className="absolute left-0 top-4 -ml-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-900"></div>
              <div className="absolute left-0 top-4 -ml-1 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-700"></div>
            </div>
          )}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
            {trendIcons[trend]}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

