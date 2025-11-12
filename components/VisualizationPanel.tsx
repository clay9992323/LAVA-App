'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { AudienceStats, CombinedPersonData } from '@/types/audience';
import { BarChart3, PieChart as PieChartIcon, Map, TrendingUp, Monitor } from 'lucide-react';

interface VisualizationPanelProps {
  audienceStats: AudienceStats | null;
  filteredData: CombinedPersonData[];
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl p-4 min-w-[200px]">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="text-sm text-gray-600">{entry.dataKey}</span>
            </div>
            <span className="font-bold text-gray-900">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Pie Tooltip Component
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total = payload[0].payload.total || data.value;
    const percentage = ((data.value / total) * 100).toFixed(1);
    
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl p-4 min-w-[200px]">
        <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Count:</span>
            <span className="font-bold text-gray-900">{data.value.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Percentage:</span>
            <span className="font-bold text-gray-900">{percentage}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function VisualizationPanel({ audienceStats, filteredData }: VisualizationPanelProps) {
  const [activeTab, setActiveTab] = useState<'demographics' | 'geography' | 'engagement' | 'overlap' | 'media'>('demographics');

  if (!audienceStats) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 tracking-tight">
              Data Visualizations
            </h2>
            <p className="text-gray-600 text-sm lg:text-base">
              Interactive charts and insights for your audience
            </p>
          </div>
        </div>
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading visualizations...</p>
          <p className="text-sm">Preparing charts and graphs</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const ageData = Object.entries(audienceStats.demographics?.age || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      // Define age range order
      const ageOrder = [
        '18-24', '25-34', '35-44', '45-54', '55-64', '65+',
        'Unknown', 'Other' // Handle any unexpected values
      ];
      const aIndex = ageOrder.indexOf(a.name);
      const bIndex = ageOrder.indexOf(b.name);
      
      // If both are in the order array, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one is in the order array, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither is in the order array, sort alphabetically
      return a.name.localeCompare(b.name);
    });

  const genderData = Object.entries(audienceStats.demographics?.gender || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const ethnicityData = Object.entries(audienceStats.demographics?.ethnicity || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const stateData = Object.entries(audienceStats.geography?.state || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const cityData = Object.entries(audienceStats.geography?.city || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Calculate totals for pie charts
  const engagementTotal = (audienceStats.engagement?.high || 0) + (audienceStats.engagement?.medium || 0) + (audienceStats.engagement?.low || 0);
  const politicalTotal = (audienceStats.political?.democrat || 0) + (audienceStats.political?.republican || 0) + (audienceStats.political?.independent || 0) + (audienceStats.political?.swing || 0);
  const mediaTotal = (audienceStats.mediaConsumption?.socialmediaheavyuser || 0) + (audienceStats.mediaConsumption?.socialmediauserfacebook || 0) + (audienceStats.mediaConsumption?.socialmediauserinstagram || 0) + (audienceStats.mediaConsumption?.socialmediauserx || 0) + (audienceStats.mediaConsumption?.socialmediauseryoutube || 0);

  const engagementData = [
    { name: 'High', value: audienceStats.engagement?.high || 0, color: '#FF8C4D', total: engagementTotal },
    { name: 'Medium', value: audienceStats.engagement?.medium || 0, color: '#FFB333', total: engagementTotal },
    { name: 'Low', value: audienceStats.engagement?.low || 0, color: '#FF6B6B', total: engagementTotal },
  ];

  const politicalData = [
    { name: 'Democrat', value: audienceStats.political?.democrat || 0, color: '#3B82F6', total: politicalTotal },
    { name: 'Republican', value: audienceStats.political?.republican || 0, color: '#EF4444', total: politicalTotal },
    { name: 'Independent', value: audienceStats.political?.independent || 0, color: '#6B7280', total: politicalTotal },
    { name: 'Swing', value: audienceStats.political?.swing || 0, color: '#8B5CF6', total: politicalTotal },
  ];

  const mediaConsumptionData = [
    { name: 'Social Media Heavy', value: audienceStats.mediaConsumption?.socialmediaheavyuser || 0, color: '#3B82F6', total: mediaTotal },
    { name: 'Facebook User', value: audienceStats.mediaConsumption?.socialmediauserfacebook || 0, color: '#1877F2', total: mediaTotal },
    { name: 'Instagram User', value: audienceStats.mediaConsumption?.socialmediauserinstagram || 0, color: '#E4405F', total: mediaTotal },
    { name: 'X User', value: audienceStats.mediaConsumption?.socialmediauserx || 0, color: '#1DA1F2', total: mediaTotal },
    { name: 'YouTube User', value: audienceStats.mediaConsumption?.socialmediauseryoutube || 0, color: '#FF0000', total: mediaTotal },
  ];

  const tabs = [
    { key: 'demographics', label: 'Demographics', icon: BarChart3 },
    { key: 'geography', label: 'Geography', icon: Map },
    { key: 'engagement', label: 'Engagement', icon: TrendingUp },
    { key: 'overlap', label: 'Political', icon: PieChartIcon },
    { key: 'media', label: 'Media Consumption', icon: Monitor },
  ];

  const COLORS = {
    blue: '#3B82F6',
    green: '#10B981',
    purple: '#8B5CF6',
    orange: '#FF8C4D',
    yellow: '#FFB333',
    red: '#EF4444',
    indigo: '#6366F1',
    teal: '#14B8A6',
    pink: '#EC4899',
    gray: '#6B7280',
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
            Data Visualizations
          </h2>
          <p className="text-gray-600 text-sm lg:text-base font-medium">
            Interactive charts and insights for your audience
          </p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl border border-orange-200 shadow-sm">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-sm"></div>
          <span className="text-orange-700 text-sm font-bold">Live Charts</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 p-2 bg-gray-50 rounded-2xl border border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                activeTab === tab.key
                  ? 'text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
              style={activeTab === tab.key ? {
                background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
              } : {}}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'demographics' && (
          <div className="space-y-8">
            {/* Age Distribution */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl border border-blue-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                Age Distribution
                <span className="ml-auto text-sm font-normal text-gray-500">
                  Total: {ageData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ageData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                    stroke="#6B7280"
                    axisLine={{ stroke: '#D1D5DB' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                    stroke="#6B7280"
                    axisLine={{ stroke: '#D1D5DB' }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="value" 
                    fill="url(#blueGradient)"
                    radius={[6, 6, 0, 0]}
                    stroke="#3B82F6"
                    strokeWidth={0.5}
                  />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="50%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#1D4ED8" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gender & Party Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl border border-green-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3 shadow-sm"></div>
                  Gender Distribution
                  <span className="ml-auto text-sm font-normal text-gray-500">
                    Total: {genderData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                  </span>
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {genderData.map((entry, index) => {
                        // Use specific colors for gender
                        let fillColor;
                        if (entry.name.toLowerCase().includes('female') || entry.name.toLowerCase().includes('woman')) {
                          fillColor = '#FF4080';
                        } else if (entry.name.toLowerCase().includes('male') || entry.name.toLowerCase().includes('man')) {
                          fillColor = '#FFB333';
                        } else {
                          // Fallback for other values
                          fillColor = index === 0 ? COLORS.green : COLORS.teal;
                        }
                        return <Cell key={`cell-${index}`} fill={fillColor} />;
                      })}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl border border-purple-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-3 shadow-sm"></div>
                  Ethnicity Distribution
                  <span className="ml-auto text-sm font-normal text-gray-500">
                    Total: {ethnicityData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                  </span>
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={ethnicityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {ethnicityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[COLORS.blue, COLORS.red, COLORS.gray, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.yellow, COLORS.pink][index]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'geography' && (
          <div className="space-y-8">
            {/* State Distribution */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-100 rounded-2xl border border-indigo-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
                State Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stateData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="url(#indigoGradient)"
                    radius={[0, 4, 4, 0]}
                  />
                  <defs>
                    <linearGradient id="indigoGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* City Distribution */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-100 rounded-2xl border border-teal-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-teal-500 rounded-full mr-3"></div>
                Top Cities
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="url(#tealGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-8">
            {/* Engagement Level */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-2xl border border-orange-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-3 shadow-sm"></div>
                Engagement Level Distribution
                <span className="ml-auto text-sm font-normal text-gray-500">
                  Total: {engagementTotal.toLocaleString()}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={engagementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={130}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                  >
                    {engagementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'overlap' && (
          <div className="space-y-8">
            {/* Political Affiliation */}
            <div className="bg-gradient-to-br from-red-50 to-pink-100 rounded-2xl border border-red-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3 shadow-sm"></div>
                Political Affiliation Distribution
                <span className="ml-auto text-sm font-normal text-gray-500">
                  Total: {politicalTotal.toLocaleString()}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={politicalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={130}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                  >
                    {politicalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-8">
            {/* Media Consumption */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-2xl border border-blue-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                Social Media Usage Distribution
                <span className="ml-auto text-sm font-normal text-gray-500">
                  Total: {mediaTotal.toLocaleString()}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={mediaConsumptionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={130}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                  >
                    {mediaConsumptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}