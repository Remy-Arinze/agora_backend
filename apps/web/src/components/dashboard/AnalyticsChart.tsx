'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  name: string;
  value?: number;
  [key: string]: any;
}

interface AnalyticsChartProps {
  title: string;
  data: Array<Record<string, any> & { name: string }>;
  type?: 'line' | 'bar' | 'area' | 'pie' | 'donut' | 'horizontal';
  dataKeys: string[];
  colors?: string[];
}

export function AnalyticsChart({
  title,
  data,
  type = 'line',
  dataKeys,
  colors = ['#3b82f6', '#10b981', '#f59e0b'],
}: AnalyticsChartProps) {
  const chartConfig = {
    text: {
      fill: '#94a3b8',
      fontSize: 12,
    },
    grid: {
      stroke: '#1a2f5c',
    },
  };

  const renderChart = () => {
    switch (type) {
      case 'pie':
      case 'donut':
        // For pie/donut charts, transform the data
        // If multiple dataKeys, show distribution between them
        // If single dataKey, show distribution across data points
        let pieData;
        if (dataKeys.length > 1) {
          // Multiple keys: aggregate each key across all data points
          pieData = dataKeys.map((key, index) => {
            const total = data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
            return {
              name: key.charAt(0).toUpperCase() + key.slice(1),
              value: total,
              color: colors[index % colors.length],
            };
          });
        } else {
          // Single key: show distribution across data points
          const key = dataKeys[0];
          pieData = data.map((item, index) => ({
            name: item.name || `Item ${index + 1}`,
            value: Number(item[key]) || 0,
            color: colors[index % colors.length],
          }));
        }

        // Calculate total for percentages
        const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0);

        // Custom label to show percentage inside the chart
        const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
          if (percent < 0.05) return null; // Don't show label for very small slices
          const RADIAN = Math.PI / 180;
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          
          return (
            <text
              x={x}
              y={y}
              fill="white"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight="bold"
            >
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        };
        
        return (
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={type === 'donut' ? 80 : 100}
              innerRadius={type === 'donut' ? 40 : 0}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                const percent = ((value / pieTotal) * 100).toFixed(1);
                return [`${value} (${percent}%)`, props.payload.name];
              }}
              contentStyle={{
                backgroundColor: '#0f1b3d',
                border: '1px solid #1a2f5c',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '8px 12px',
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '5px', fontSize: '9px' }}
              iconSize={8}
              formatter={(value, entry: any) => {
                const displayName = value.length > 10 ? `${value.substring(0, 10)}...` : value;
                return <span style={{ fontSize: '12px', color: '#94a3b8' }}>{displayName}</span>;
              }}
            />
          </PieChart>
        );
      case 'horizontal':
        return (
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5c" />
            <XAxis type="number" {...chartConfig} />
            <YAxis dataKey="name" type="category" {...chartConfig} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1b3d',
                border: '1px solid #1a2f5c',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5c" />
            <XAxis dataKey="name" {...chartConfig} />
            <YAxis {...chartConfig} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1b3d',
                border: '1px solid #1a2f5c',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        );
      default:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5c" />
            <XAxis dataKey="name" {...chartConfig} />
            <YAxis {...chartConfig} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1b3d',
                border: '1px solid #1a2f5c',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], r: 4 }}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

