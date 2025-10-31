"use client";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'blue',
}: KPICardProps) {
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
    <div className={`bg-gray-800/50 border border-gray-700 rounded-2xl p-6 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
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

