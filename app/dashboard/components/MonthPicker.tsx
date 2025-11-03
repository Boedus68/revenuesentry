"use client";

import { useState, useEffect } from 'react';

interface MonthPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (month: string) => void;
  excludeMonths?: string[]; // Mesi già selezionati da escludere
}

const mesi = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export default function MonthPicker({ isOpen, onClose, onSelect, excludeMonths = [] }: MonthPickerProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedYear(new Date().getFullYear());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMonthClick = (monthIndex: number) => {
    const monthString = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (!excludeMonths.includes(monthString)) {
      onSelect(monthString);
      onClose();
    }
  };

  const isMonthExcluded = (monthIndex: number) => {
    const monthString = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    return excludeMonths.includes(monthString);
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Seleziona Mese</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition p-1"
              aria-label="Chiudi"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Selettore Anno */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-300">Anno:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Griglia Mesi */}
        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            {mesi.map((mese, index) => {
              const isExcluded = isMonthExcluded(index);
              const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === selectedYear;
              
              return (
                <button
                  key={index}
                  onClick={() => handleMonthClick(index)}
                  disabled={isExcluded}
                  onMouseEnter={() => setHoveredMonth(index)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-200
                    ${isExcluded
                      ? 'bg-gray-900/50 border-gray-700 cursor-not-allowed opacity-50'
                      : isCurrentMonth
                      ? 'bg-blue-600/20 border-blue-500 hover:bg-blue-600/30'
                      : hoveredMonth === index
                      ? 'bg-blue-600/10 border-blue-400'
                      : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    }
                  `}
                >
                  <div className="text-center">
                    <div className={`font-semibold text-sm ${
                      isExcluded ? 'text-gray-500' : 'text-white'
                    }`}>
                      {mese}
                    </div>
                    {isCurrentMonth && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                    {isExcluded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-400 text-center">
            I mesi già utilizzati sono disabilitati
          </p>
        </div>
      </div>
    </div>
  );
}

