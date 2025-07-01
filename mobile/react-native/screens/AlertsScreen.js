/**
 * Alerts Screen
 * Real-time notifications and alert management
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Vibration
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PushNotification from 'react-native-push-notification';
import { SwipeListView } from 'react-native-swipe-list-view';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import LinearGradient from 'react-native-linear-gradient';

const AlertsScreen = () => {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all'); // all, critical, warning, info
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const swipeListRef = useRef(null);

  // Sample alerts data
  const sampleAlerts = [
    {
      id: '1',
      type: 'critical',
      title: 'Container MSKU1234567 Delayed',
      message: 'Shipment delayed by 6 hours due to port congestion',
      containerId: 'MSKU1234567',
      timestamp: new Date(Date.now() - 300000), // 5 mins ago
      read: false,
      actions: ['View Details', 'Contact Carrier']
    },
    {
      id: '2',
      type: 'warning',
      title: 'Temperature Excursion Detected',
      message: 'Container HLCU8765432 temperature exceeded threshold',
      containerId: 'HLCU8765432',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      read: false,
      actions: ['View Details', 'Acknowledge']
    },
    {
      id: '3',
      type: 'info',
      title: 'Container Arrived at Port',
      message: 'CMAU3456789 has arrived at Los Angeles Port',
      containerId: 'CMAU3456789',
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      read: true,
      actions: ['Track Container']
    },
    {
      id: '4',
      type: 'critical',
      title: 'Customs Hold',
      message: 'Container OOLU9876543 held for customs inspection',
      containerId: 'OOLU9876543',
      timestamp: new Date(Date.now() - 14400000), // 4 hours ago
      read: false,
      actions: ['View Details', 'Contact Customs']
    },
    {
      id: '5',
      type: 'warning',
      title: 'Route Deviation Detected',
      message: 'Container MSCU5432109 deviated from planned route',
      containerId: 'MSCU5432109',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      read: true,
      actions: ['View Route', 'Contact Driver']
    }
  ];

  useEffect(() => {
    loadAlerts();
    setupNotifications();
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    // Listen for new push notifications
    PushNotification.configure({
      onNotification: function (notification) {
        handleNewNotification(notification);
      },
    });

    return () => unsubscribe();
  }, []);

  const setupNotifications = () => {
    // Create notification channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel({
        channelId: 'rootuip-alerts',
        channelName: 'ROOTUIP Alerts',
        channelDescription: 'Container tracking alerts and notifications',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      });
    }
  };

  const loadAlerts = async () => {
    try {
      // Try to load from cache first
      const cachedAlerts = await AsyncStorage.getItem('alerts');
      if (cachedAlerts) {
        setAlerts(JSON.parse(cachedAlerts));
      }

      // Fetch fresh data if online
      if (isOnline) {
        // In production, this would be an API call
        setTimeout(() => {
          setAlerts(sampleAlerts);
          AsyncStorage.setItem('alerts', JSON.stringify(sampleAlerts));
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
      setAlerts(sampleAlerts);
    }
  };

  const handleNewNotification = (notification) => {
    // Vibrate on new critical alert
    if (notification.data?.type === 'critical') {
      Vibration.vibrate([0, 500, 200, 500]);
    }

    // Add to alerts list
    const newAlert = {
      id: Date.now().toString(),
      type: notification.data?.type || 'info',
      title: notification.title,
      message: notification.message,
      containerId: notification.data?.containerId,
      timestamp: new Date(),
      read: false,
      actions: notification.data?.actions || ['View Details']
    };

    setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const markAsRead = async (alertId) => {
    const updatedAlerts = alerts.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    );
    setAlerts(updatedAlerts);
    await AsyncStorage.setItem('alerts', JSON.stringify(updatedAlerts));
  };

  const deleteAlert = async (alertId) => {
    const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
    setAlerts(updatedAlerts);
    await AsyncStorage.setItem('alerts', JSON.stringify(updatedAlerts));
  };

  const handleAlertAction = (alert, action) => {
    markAsRead(alert.id);

    switch (action) {
      case 'View Details':
        if (alert.containerId) {
          navigation.navigate('ContainerDetail', { containerId: alert.containerId });
        }
        break;
      
      case 'Track Container':
        if (alert.containerId) {
          navigation.navigate('Tracking', { containerId: alert.containerId });
        }
        break;
      
      case 'Contact Carrier':
      case 'Contact Customs':
      case 'Contact Driver':
        Alert.alert(
          'Contact Information',
          'Opening communication channel...',
          [
            { text: 'Call', onPress: () => console.log('Calling...') },
            { text: 'Email', onPress: () => console.log('Opening email...') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        break;
      
      case 'Acknowledge':
        Alert.alert('Alert Acknowledged', 'The alert has been acknowledged and logged.');
        break;
      
      default:
        console.log('Action:', action);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'notifications';
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'critical':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'info':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return timestamp.toLocaleDateString();
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.type === filter);

  const unreadCount = alerts.filter(alert => !alert.read).length;

  const renderAlert = ({ item }) => (
    <TouchableOpacity
      style={[styles.alertCard, !item.read && styles.unreadAlert]}
      onPress={() => markAsRead(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <View style={[styles.alertIcon, { backgroundColor: getAlertColor(item.type) }]}>
            <Icon name={getAlertIcon(item.type)} size={24} color="#fff" />
          </View>
          <View style={styles.alertTextContainer}>
            <Text style={[styles.alertTitle, !item.read && styles.unreadText]}>
              {item.title}
            </Text>
            <Text style={styles.alertMessage} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.alertTimestamp}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
        
        {item.actions && item.actions.length > 0 && (
          <View style={styles.actionButtons}>
            {item.actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionButton,
                  index === 0 && styles.primaryAction
                ]}
                onPress={() => handleAlertAction(item, action)}
              >
                <Text style={[
                  styles.actionButtonText,
                  index === 0 && styles.primaryActionText
                ]}>
                  {action}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHiddenItem = ({ item }) => (
    <View style={styles.rowBack}>
      <TouchableOpacity
        style={[styles.backBtn, styles.backBtnLeft]}
        onPress={() => markAsRead(item.id)}
      >
        <Icon name="check" size={24} color="#fff" />
        <Text style={styles.backTextWhite}>Read</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.backBtn, styles.backBtnRight]}
        onPress={() => {
          Alert.alert(
            'Delete Alert',
            'Are you sure you want to delete this alert?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', onPress: () => deleteAlert(item.id), style: 'destructive' }
            ]
          );
        }}
      >
        <Icon name="delete" size={24} color="#fff" />
        <Text style={styles.backTextWhite}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0066CC', '#004C99']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Icon name="cloud-off" size={16} color="#fff" />
            <Text style={styles.offlineText}>Offline - Showing cached alerts</Text>
          </View>
        )}
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.activeFilter]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
            All ({alerts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'critical' && styles.activeFilter]}
          onPress={() => setFilter('critical')}
        >
          <Text style={[styles.filterText, filter === 'critical' && styles.activeFilterText]}>
            Critical ({alerts.filter(a => a.type === 'critical').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'warning' && styles.activeFilter]}
          onPress={() => setFilter('warning')}
        >
          <Text style={[styles.filterText, filter === 'warning' && styles.activeFilterText]}>
            Warning ({alerts.filter(a => a.type === 'warning').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'info' && styles.activeFilter]}
          onPress={() => setFilter('info')}
        >
          <Text style={[styles.filterText, filter === 'info' && styles.activeFilterText]}>
            Info ({alerts.filter(a => a.type === 'info').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alerts List */}
      <SwipeListView
        ref={swipeListRef}
        data={filteredAlerts}
        renderItem={renderAlert}
        renderHiddenItem={renderHiddenItem}
        leftOpenValue={75}
        rightOpenValue={-75}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0066CC']}
            tintColor="#0066CC"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="notifications-none" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No alerts</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        }
      />

      {/* Quick Actions FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Alert.alert(
            'Alert Settings',
            'Configure your notification preferences',
            [
              { text: 'Notification Settings', onPress: () => navigation.navigate('NotificationSettings') },
              { text: 'Alert Rules', onPress: () => navigation.navigate('AlertRules') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
      >
        <Icon name="settings" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeFilter: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#0066CC',
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 80,
  },
  alertCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unreadAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  alertContent: {
    padding: 15,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  alertTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    marginLeft: 56,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  primaryAction: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#666',
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '500',
  },
  rowBack: {
    alignItems: 'center',
    backgroundColor: '#DDD',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 15,
    paddingRight: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 12,
  },
  backBtn: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 75,
    flexDirection: 'column',
  },
  backBtnLeft: {
    backgroundColor: '#4CAF50',
    left: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  backBtnRight: {
    backgroundColor: '#F44336',
    right: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  backTextWhite: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default AlertsScreen;