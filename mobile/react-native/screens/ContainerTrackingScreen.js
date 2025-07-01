/**
 * Container Tracking Screen
 * Real-time container tracking with GPS integration
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Linking
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Geolocation from '@react-native-community/geolocation';
import { Camera } from 'react-native-camera';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const ContainerTrackingScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  
  // Sample container data
  const [recentContainers] = useState([
    {
      id: 'MSKU1234567',
      status: 'In Transit',
      location: { latitude: 37.4419, longitude: -122.1430 },
      destination: 'Los Angeles Port',
      eta: '2024-01-15 14:30',
      lastUpdate: '5 mins ago',
      route: [
        { latitude: 37.4419, longitude: -122.1430 },
        { latitude: 36.7783, longitude: -119.4179 },
        { latitude: 34.0522, longitude: -118.2437 }
      ]
    },
    {
      id: 'HLCU8765432',
      status: 'At Port',
      location: { latitude: 34.0522, longitude: -118.2437 },
      destination: 'Chicago Terminal',
      eta: '2024-01-18 09:00',
      lastUpdate: '1 hour ago'
    },
    {
      id: 'CMAU3456789',
      status: 'Delayed',
      location: { latitude: 40.7128, longitude: -74.0060 },
      destination: 'Newark Port',
      eta: '2024-01-16 11:00',
      lastUpdate: '30 mins ago',
      delay: '4 hours'
    }
  ]);

  useEffect(() => {
    // Get current location
    getCurrentLocation();
    
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    // Load cached data
    loadCachedContainers();

    return () => unsubscribe();
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      error => console.log('Location error:', error),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  const loadCachedContainers = async () => {
    try {
      const cached = await AsyncStorage.getItem('recentContainers');
      if (cached) {
        setContainers(JSON.parse(cached));
      } else {
        setContainers(recentContainers);
      }
    } catch (error) {
      console.error('Failed to load cached containers:', error);
      setContainers(recentContainers);
    }
  };

  const searchContainer = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // Check offline cache first
      const cached = await AsyncStorage.getItem(`container_${searchQuery}`);
      if (cached && !isOnline) {
        const container = JSON.parse(cached);
        setSelectedContainer(container);
        focusOnContainer(container);
      } else if (isOnline) {
        // Simulate API call
        setTimeout(() => {
          const found = recentContainers.find(c => 
            c.id.toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (found) {
            setSelectedContainer(found);
            focusOnContainer(found);
            // Cache for offline use
            AsyncStorage.setItem(`container_${found.id}`, JSON.stringify(found));
          } else {
            Alert.alert('Not Found', 'Container not found. Please check the ID.');
          }
          setLoading(false);
        }, 1000);
      } else {
        Alert.alert('Offline', 'Container not found in offline cache.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setLoading(false);
    }
  };

  const focusOnContainer = (container) => {
    if (mapRef.current && container.location) {
      mapRef.current.animateToRegion({
        ...container.location,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  const onQRCodeRead = (e) => {
    setShowScanner(false);
    setSearchQuery(e.data);
    searchContainer();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Transit': return '#4CAF50';
      case 'At Port': return '#2196F3';
      case 'Delayed': return '#F44336';
      case 'Delivered': return '#8BC34A';
      default: return '#757575';
    }
  };

  const openDirections = (container) => {
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${container.location.latitude},${container.location.longitude}`;
    const label = container.id;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    Linking.openURL(url);
  };

  const renderContainer = ({ item }) => (
    <TouchableOpacity
      style={styles.containerCard}
      onPress={() => {
        setSelectedContainer(item);
        focusOnContainer(item);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.containerHeader}>
        <Text style={styles.containerId}>{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.containerInfo}>
        <View style={styles.infoRow}>
          <Icon name="location-on" size={16} color="#666" />
          <Text style={styles.infoText}>{item.destination}</Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="schedule" size={16} color="#666" />
          <Text style={styles.infoText}>ETA: {item.eta}</Text>
        </View>
        {item.delay && (
          <View style={styles.infoRow}>
            <Icon name="warning" size={16} color="#F44336" />
            <Text style={[styles.infoText, { color: '#F44336' }]}>
              Delayed by {item.delay}
            </Text>
          </View>
        )}
        <Text style={styles.lastUpdate}>Updated {item.lastUpdate}</Text>
      </View>
    </TouchableOpacity>
  );

  if (showScanner) {
    return (
      <QRCodeScanner
        onRead={onQRCodeRead}
        topContent={
          <Text style={styles.scannerText}>
            Scan container QR code
          </Text>
        }
        bottomContent={
          <TouchableOpacity
            style={styles.scannerButton}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.scannerButtonText}>Cancel</Text>
          </TouchableOpacity>
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={24} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search container ID..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchContainer}
            autoCapitalize="characters"
          />
          <TouchableOpacity onPress={() => setShowScanner(true)}>
            <Icon name="qr-code-scanner" size={24} color="#0066CC" />
          </TouchableOpacity>
        </View>
        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Icon name="cloud-off" size={16} color="#fff" />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        )}
      </View>

      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: currentLocation?.latitude || 37.7749,
          longitude: currentLocation?.longitude || -122.4194,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            pinColor="#0066CC"
          />
        )}

        {/* Container Markers */}
        {containers.map(container => (
          <Marker
            key={container.id}
            coordinate={container.location}
            title={container.id}
            description={`Status: ${container.status}`}
            pinColor={getStatusColor(container.status)}
            onPress={() => setSelectedContainer(container)}
          />
        ))}

        {/* Selected Container Route */}
        {selectedContainer?.route && (
          <Polyline
            coordinates={selectedContainer.route}
            strokeColor="#0066CC"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Container List */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Recent Containers</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#0066CC" style={styles.loader} />
        ) : (
          <FlatList
            data={containers}
            renderItem={renderContainer}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Selected Container Details */}
      {selectedContainer && (
        <TouchableOpacity
          style={styles.detailsCard}
          onPress={() => navigation.navigate('ContainerDetail', { container: selectedContainer })}
          activeOpacity={0.9}
        >
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>{selectedContainer.id}</Text>
            <TouchableOpacity
              onPress={() => openDirections(selectedContainer)}
              style={styles.directionsButton}
            >
              <Icon name="directions" size={20} color="#0066CC" />
            </TouchableOpacity>
          </View>
          <View style={styles.detailsContent}>
            <Text style={styles.detailsText}>
              <Icon name="location-on" size={14} color="#666" /> {selectedContainer.destination}
            </Text>
            <Text style={styles.detailsText}>
              <Icon name="schedule" size={14} color="#666" /> ETA: {selectedContainer.eta}
            </Text>
            <TouchableOpacity style={styles.viewDetailsButton}>
              <Text style={styles.viewDetailsText}>View Full Details</Text>
              <Icon name="chevron-right" size={20} color="#0066CC" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 16,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  map: {
    flex: 1,
  },
  listContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 15,
  },
  containerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    width: 280,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  containerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  containerId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  containerInfo: {
    marginTop: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  loader: {
    marginTop: 20,
  },
  detailsCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  directionsButton: {
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
  },
  detailsContent: {
    marginTop: 5,
  },
  detailsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  viewDetailsText: {
    fontSize: 16,
    color: '#0066CC',
    fontWeight: '500',
  },
  scannerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  scannerButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  scannerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ContainerTrackingScreen;