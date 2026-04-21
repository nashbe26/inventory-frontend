import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import {
  FaChartBar,
  FaClock,
  FaCheckCircle,
  FaTruck,
  FaBoxOpen,
  FaTimesCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';

export default function EmployeeKPIs() {
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'monthly'
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: kpiData, isLoading, error } = useQuery({
    queryKey: ['employeeKPIs', viewMode, viewMode === 'daily' ? selectedDate : selectedMonth],
    queryFn: async () => {
      const endpoint = viewMode === 'daily' 
        ? `/kpis/daily?date=${selectedDate}` 
        : `/kpis/monthly?month=${selectedMonth}`;
      const res = await api.get(endpoint);
      return res.data.data;
    }
  });

  const calculateTotalHours = (timeEntries) => {
    let totalMinutes = 0;
    timeEntries.forEach((entry) => {
      if (entry.clockInAt && entry.clockOutAt) {
        totalMinutes += differenceInMinutes(parseISO(entry.clockOutAt), parseISO(entry.clockInAt));
      } else if (entry.clockInAt && !entry.clockOutAt) {
        // If still clocked in on today's date, calculate up to now
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        if (selectedDate === todayStr) {
             totalMinutes += differenceInMinutes(new Date(), parseISO(entry.clockInAt));
        }
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading KPIs...</div>;
  }

  if (error) {
    return <div className="text-red-600 text-center mt-10">Error loading data.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employee KPIs</h1>
          <p className="mt-2 text-sm text-gray-700">
            Performance metrics and time tracking.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-4 py-1 text-sm font-medium rounded-md ${
                viewMode === 'daily' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-1 text-sm font-medium rounded-md ${
                viewMode === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
          </div>
          
          {viewMode === 'daily' ? (
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border p-2"
            />
          ) : (
            <input
              id="month-picker"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border p-2"
            />
          )}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {kpiData && kpiData.length > 0 ? (
            kpiData.map((kpi, idx) => (
              <li key={kpi.user._id || idx}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {kpi.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-indigo-600">
                          {kpi.user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {kpi.user.role}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 sm:flex sm:justify-between sm:items-center">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 w-full">
                      <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                        <FaCheckCircle className="h-6 w-6 text-green-500 mb-1" />
                        <span className="text-sm text-gray-500">Confirmed</span>
                        <span className="text-lg font-semibold text-gray-900">{kpi.confirmed}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                        <FaTimesCircle className="h-6 w-6 text-red-500 mb-1" />
                        <span className="text-sm text-gray-500">Cancelled</span>
                        <span className="text-lg font-semibold text-gray-900">{kpi.cancelled}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                        <FaBoxOpen className="h-6 w-6 text-blue-500 mb-1" />
                        <span className="text-sm text-gray-500">Prepared</span>
                        <span className="text-lg font-semibold text-gray-900">{kpi.prepared}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                        <FaTruck className="h-6 w-6 text-orange-500 mb-1" />
                        <span className="text-sm text-gray-500">Dispatched</span>
                        <span className="text-lg font-semibold text-gray-900">{kpi.dispatched}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                        <FaClock className="h-6 w-6 text-purple-500 mb-1" />
                        <span className="text-sm text-gray-500">Time Worked</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {calculateTotalHours(kpi.timeEntries)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {kpi.timeEntries.length > 0 && viewMode === 'daily' && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Time Entries</h4>
                      <div className="space-y-1">
                        {kpi.timeEntries.map((entry, index) => (
                          <div key={index} className="text-sm text-gray-600 flex space-x-4">
                            <span>In: {entry.clockInAt ? format(parseISO(entry.clockInAt), 'HH:mm') : '-'}</span>
                            <span>Out: {entry.clockOutAt ? format(parseISO(entry.clockOutAt), 'HH:mm') : 'Currently working'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {kpi.timeEntries.length > 0 && viewMode === 'monthly' && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                       <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total shifts: {kpi.timeEntries.length}</h4>
                    </div>
                  )}
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-8 text-center text-gray-500">
              No KPI data found for this date.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}