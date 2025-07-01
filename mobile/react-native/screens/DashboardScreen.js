/**
 * Dashboard Screen - Executive Summary View
 * Optimized for mobile viewing with key metrics
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform
} from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

const DashboardScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    totalContainers: 847293,
    activeShipments: 42156,
    delayedShipments: 1247,
    onTimeDelivery: 94.2,
    alerts: 8,
    revenue: 12.4
  });

  const [chartData, setChartData] = useState({
    shipmentTrend: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        data: [4200, 4500, 4300, 4800, 5200, 3900, 3600]
      }]
    },
    containerStatus: [
      {
        name: 'In Transit',
        population: 65,
        color: '#4CAF50',
        legendFontColor: '#333',
        legendFontSize: 12
      },
      {
        name: 'At Port',
        population: 20,
        color: '#2196F3',
        legendFontColor: '#333',
        legendFontSize: 12
      },
      {
        name: 'Delivered',
        population: 10,
        color: '#FF9800',
        legendFontColor: '#333',
        legendFontSize: 12
      },
      {
        name: 'Delayed',
        population: 5,
        color: '#F44336',
        legendFontColor: '#333',
        legendFontSize: 12
      }
    ]
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Check for cached data first (offline support)
      const cachedData = await AsyncStorage.getItem('dashboardData');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        setMetrics(parsed.metrics);
        setChartData(parsed.chartData);
      }

      // Fetch fresh data if online
      // In production, this would be an API call
      const freshData = await fetchDashboardData();
      if (freshData) {
        setMetrics(freshData.metrics);
        setChartData(freshData.chartData);
        
        // Cache for offline use
        await AsyncStorage.setItem('dashboardData', JSON.stringify(freshData));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const fetchDashboardData = async () => {
    // Simulated API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          metrics: {
            totalContainers: Math.floor(Math.random() * 50000) + 800000,
            activeShipments: Math.floor(Math.random() * 5000) + 40000,
            delayedShipments: Math.floor(Math.random() * 500) + 1000,
            onTimeDelivery: (Math.random() * 5 + 92).toFixed(1),
            alerts: Math.floor(Math.random() * 15) + 5,
            revenue: (Math.random() * 3 + 11).toFixed(1)
          },
          chartData: chartData // Keep existing for demo
        });
      }, 1000);
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const MetricCard = ({ title, value, subtitle, icon, color, onPress }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[color, color + 'DD']}
        style={styles.metricCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.metricHeader}>
          <Icon name={icon} size={24} color="#fff" />
          <Text style={styles.metricTitle}>{title}</Text>
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#0066CC']}
          tintColor="#0066CC"
        />
      }
    >
      {/* Executive Summary */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good Morning, Executive</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</Text>
      </View>

      {/* Key Metrics Grid */}
      <View style={styles.metricsGrid}>
        <MetricCard
          title="Total Containers"
          value={metrics.totalContainers.toLocaleString()}
          subtitle="Tracked globally"
          icon="local-shipping"
          color="#4CAF50"
          onPress={() => navigation.navigate('Tracking')}
        />
        <MetricCard
          title="Active Shipments"
          value={metrics.activeShipments.toLocaleString()}
          subtitle="In transit"
          icon="directions-boat"
          color="#2196F3"
          onPress={() => navigation.navigate('Tracking')}
        />
        <MetricCard
          title="On-Time Delivery"
          value={`${metrics.onTimeDelivery}%`}
          subtitle="This month"
          icon="check-circle"
          color="#8BC34A"
        />
        <MetricCard
          title="Critical Alerts"
          value={metrics.alerts}
          subtitle="Require attention"
          icon="warning"
          color="#FF5722"
          onPress={() => navigation.navigate('Alerts')}
        />
      </View>

      {/* Revenue Card */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.revenueCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.revenueHeader}>
          <Text style={styles.revenueTitle}>Monthly Revenue</Text>
          <Icon name="trending-up" size={24} color="#4ADE80" />
        </View>
        <Text style={styles.revenueValue}>${metrics.revenue}M</Text>
        <Text style={styles.revenueChange}>+12.5% from last month</Text>
      </LinearGradient>

      {/* Shipment Trend Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Weekly Shipment Trend</Text>
        <LineChart
          data={chartData.shipmentTrend}
          width={screenWidth - 40}
          height={200}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 102, 204, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#0066CC'
            }
          }}
          bezier
          style={styles.chart}
        />
      </View>

      {/* Container Status Distribution */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Container Status Distribution</Text>
        <PieChart
          data={chartData.containerStatus}
          width={screenWidth - 40}
          height={200}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Tracking')}
          >
            <Icon name="qr-code-scanner" size={28} color="#0066CC" />
            <Text style={styles.actionText}>Scan Container</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Scan')}
          >
            <Icon name="add-photo-alternate" size={28} color="#0066CC" />
            <Text style={styles.actionText}>Upload Document</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Alerts')}
          >
            <Icon name="notifications-active" size={28} color="#0066CC" />
            <Text style={styles.actionText}>View Alerts</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (screenWidth - 30) / 2,
    padding: 20,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#ffffffCC',
    marginTop: 5,
  },
  revenueCard: {
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  revenueTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  revenueValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  revenueChange: {
    fontSize: 14,
    color: '#4ADE80',
    marginTop: 5,
  },
  chartCard: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  quickActions: {
    margin: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DashboardScreen;