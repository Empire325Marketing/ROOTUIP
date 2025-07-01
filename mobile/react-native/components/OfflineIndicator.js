/**
 * Offline Indicator Component
 * Shows network status and offline mode functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OfflineIndicator = ({ onSync }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingSync, setPendingSync] = useState({
    containers: 0,
    documents: 0,
    alerts: 0
  });
  
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isConnected;
      setIsConnected(state.isConnected);
      
      if (wasOffline && state.isConnected) {
        // Back online - trigger sync
        handleSync();
      }
    });

    // Check initial state
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
    });

    // Load pending sync count
    loadPendingSyncCount();

    return () => unsubscribe();
  }, [isConnected]);

  useEffect(() => {
    // Animate indicator
    Animated.timing(slideAnim, {
      toValue: isConnected ? -100 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pulse animation when offline
    if (!isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  const loadPendingSyncCount = async () => {
    try {
      const [containers, documents, alerts] = await Promise.all([
        AsyncStorage.getItem('pendingContainerUpdates'),
        AsyncStorage.getItem('pendingDocuments'),
        AsyncStorage.getItem('pendingAlerts')
      ]);

      setPendingSync({
        containers: containers ? JSON.parse(containers).length : 0,
        documents: documents ? JSON.parse(documents).length : 0,
        alerts: alerts ? JSON.parse(alerts).length : 0
      });
    } catch (error) {
      console.error('Failed to load pending sync count:', error);
    }
  };

  const handleSync = async () => {
    if (!isConnected) return;

    try {
      // Trigger sync callback if provided
      await onSync?.();
      
      // Reload pending count
      await loadPendingSyncCount();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const totalPending = pendingSync.containers + pendingSync.documents + pendingSync.alerts;

  if (isConnected && totalPending === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.banner,
          isConnected ? styles.syncBanner : styles.offlineBanner
        ]}
        onPress={() => setShowDetails(!showDetails)}
        activeOpacity={0.8}
      >
        <View style={styles.mainContent}>
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
          >
            <Icon
              name={isConnected ? 'sync' : 'cloud-off'}
              size={20}
              color="#fff"
            />
          </Animated.View>
          
          <Text style={styles.statusText}>
            {isConnected
              ? `${totalPending} items pending sync`
              : 'You\'re offline'}
          </Text>
          
          {isConnected && totalPending > 0 && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSync}
            >
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          )}
          
          <Icon
            name={showDetails ? 'expand-less' : 'expand-more'}
            size={20}
            color="#fff"
          />
        </View>
      </TouchableOpacity>
      
      {showDetails && (
        <View style={styles.details}>
          <View style={styles.detailsContent}>
            {!isConnected ? (
              <>
                <Text style={styles.detailsTitle}>Offline Mode Active</Text>
                <Text style={styles.detailsText}>
                  All changes will be saved locally and synced when you're back online.
                </Text>
                
                <View style={styles.features}>
                  <View style={styles.featureItem}>
                    <Icon name="check-circle" size={16} color="#4CAF50" />
                    <Text style={styles.featureText}>View cached containers</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="check-circle" size={16} color="#4CAF50" />
                    <Text style={styles.featureText}>Scan documents</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="check-circle" size={16} color="#4CAF50" />
                    <Text style={styles.featureText}>Access recent data</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="cancel" size={16} color="#F44336" />
                    <Text style={styles.featureText}>Real-time updates</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.detailsTitle}>Pending Synchronization</Text>
                
                {pendingSync.containers > 0 && (
                  <View style={styles.syncItem}>
                    <Icon name="local-shipping" size={16} color="#666" />
                    <Text style={styles.syncItemText}>
                      {pendingSync.containers} container update{pendingSync.containers > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                
                {pendingSync.documents > 0 && (
                  <View style={styles.syncItem}>
                    <Icon name="insert-drive-file" size={16} color="#666" />
                    <Text style={styles.syncItemText}>
                      {pendingSync.documents} document{pendingSync.documents > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                
                {pendingSync.alerts > 0 && (
                  <View style={styles.syncItem}>
                    <Icon name="notifications" size={16} color="#666" />
                    <Text style={styles.syncItemText}>
                      {pendingSync.alerts} alert acknowledgment{pendingSync.alerts > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.syncNowButton}
                  onPress={handleSync}
                >
                  <Icon name="sync" size={20} color="#0066CC" />
                  <Text style={styles.syncNowButtonText}>Synchronize All</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 0 : 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
    paddingBottom: 10,
    paddingHorizontal: 15,
  },
  offlineBanner: {
    backgroundColor: '#F44336',
  },
  syncBanner: {
    backgroundColor: '#FF9800',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  syncButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  details: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  detailsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  features: {
    marginTop: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  syncItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 5,
  },
  syncItemText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  syncNowButtonText: {
    color: '#0066CC',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default OfflineIndicator;