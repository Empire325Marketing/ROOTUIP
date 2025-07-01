/**
 * Document Scan Screen
 * Camera integration for document capture and upload
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImagePicker from 'react-native-image-crop-picker';
import RNTextDetector from 'react-native-text-detector';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const DocumentScanScreen = () => {
  const navigation = useNavigation();
  const cameraRef = useRef(null);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashMode, setFlashMode] = useState(RNCamera.Constants.FlashMode.off);
  const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.back);
  
  // Document type detection patterns
  const documentPatterns = {
    billOfLading: /bill\s+of\s+lading|b\/l|bol/i,
    invoice: /invoice|inv\s*#|invoice\s+number/i,
    packingList: /packing\s+list|packing\s+slip/i,
    customsDeclaration: /customs|declaration|import|export/i,
    deliveryNote: /delivery\s+note|delivery\s+order|d\/n/i
  };

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      
      try {
        const options = {
          quality: 0.8,
          base64: true,
          exif: true,
          pauseAfterCapture: true,
          fixOrientation: true
        };
        
        const data = await cameraRef.current.takePictureAsync(options);
        setCapturedImage(data);
        
        // Process the image
        await processDocument(data);
      } catch (error) {
        console.error('Failed to take picture:', error);
        Alert.alert('Error', 'Failed to capture image');
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const processDocument = async (imageData) => {
    setIsProcessing(true);
    
    try {
      // Extract text using OCR
      const detectedText = await RNTextDetector.detectFromUri(imageData.uri);
      const extractedContent = detectedText.map(block => block.text).join(' ');
      setExtractedText(extractedContent);
      
      // Detect document type
      const detectedType = detectDocumentType(extractedContent);
      setDocumentType(detectedType);
      
      // Extract key information based on document type
      const extractedInfo = extractKeyInformation(extractedContent, detectedType);
      
      // Save for offline use
      await saveDocumentOffline(imageData, extractedContent, detectedType, extractedInfo);
      
    } catch (error) {
      console.error('Document processing failed:', error);
      Alert.alert('Processing Error', 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const detectDocumentType = (text) => {
    for (const [type, pattern] of Object.entries(documentPatterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }
    return 'unknown';
  };

  const extractKeyInformation = (text, docType) => {
    const info = {
      containerNumbers: [],
      dates: [],
      amounts: [],
      references: []
    };
    
    // Extract container numbers (various formats)
    const containerRegex = /[A-Z]{4}\d{7}|[A-Z]{3}\d{7}/g;
    const containers = text.match(containerRegex);
    if (containers) {
      info.containerNumbers = [...new Set(containers)];
    }
    
    // Extract dates
    const dateRegex = /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g;
    const dates = text.match(dateRegex);
    if (dates) {
      info.dates = dates;
    }
    
    // Extract amounts
    const amountRegex = /\$[\d,]+\.?\d*|USD\s*[\d,]+\.?\d*/g;
    const amounts = text.match(amountRegex);
    if (amounts) {
      info.amounts = amounts;
    }
    
    // Extract reference numbers based on document type
    switch (docType) {
      case 'billOfLading':
        const bolRegex = /B\/L\s*#?\s*:?\s*(\w+)/i;
        const bolMatch = text.match(bolRegex);
        if (bolMatch) info.references.push({ type: 'BOL', value: bolMatch[1] });
        break;
      
      case 'invoice':
        const invRegex = /INV\s*#?\s*:?\s*(\w+)|Invoice\s*#?\s*:?\s*(\w+)/i;
        const invMatch = text.match(invRegex);
        if (invMatch) info.references.push({ type: 'Invoice', value: invMatch[1] || invMatch[2] });
        break;
        
      default:
        // Generic reference number extraction
        const refRegex = /REF\s*#?\s*:?\s*(\w+)|Reference\s*:?\s*(\w+)/i;
        const refMatch = text.match(refRegex);
        if (refMatch) info.references.push({ type: 'Reference', value: refMatch[1] || refMatch[2] });
    }
    
    return info;
  };

  const saveDocumentOffline = async (imageData, text, type, info) => {
    try {
      const document = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type,
        imageUri: imageData.uri,
        extractedText: text,
        extractedInfo: info,
        synced: false
      };
      
      // Get existing documents
      const existingDocs = await AsyncStorage.getItem('scannedDocuments');
      const documents = existingDocs ? JSON.parse(existingDocs) : [];
      
      // Add new document
      documents.unshift(document);
      
      // Keep only last 50 documents for storage optimization
      if (documents.length > 50) {
        documents.splice(50);
      }
      
      // Save back to storage
      await AsyncStorage.setItem('scannedDocuments', JSON.stringify(documents));
      
      // Copy image to app's document directory for persistence
      const fileName = `doc_${document.id}.jpg`;
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.copyFile(imageData.uri, destPath);
      
      // Update document with permanent path
      document.localImagePath = destPath;
      documents[0] = document;
      await AsyncStorage.setItem('scannedDocuments', JSON.stringify(documents));
      
    } catch (error) {
      console.error('Failed to save document offline:', error);
    }
  };

  const selectFromGallery = () => {
    ImagePicker.openPicker({
      width: 1200,
      height: 1600,
      cropping: true,
      includeBase64: true,
      compressImageQuality: 0.8
    }).then(image => {
      setCapturedImage(image);
      processDocument(image);
    }).catch(error => {
      if (error.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', 'Failed to select image');
      }
    });
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setExtractedText('');
    setDocumentType('');
    if (cameraRef.current) {
      cameraRef.current.resumePreview();
    }
  };

  const saveDocument = async () => {
    if (!capturedImage || !extractedText) {
      Alert.alert('Error', 'No document to save');
      return;
    }
    
    Alert.alert(
      'Document Saved',
      `${documentType === 'unknown' ? 'Document' : documentType.replace(/([A-Z])/g, ' $1').trim()} has been saved successfully.`,
      [
        {
          text: 'Scan Another',
          onPress: retakePhoto
        },
        {
          text: 'View Documents',
          onPress: () => navigation.navigate('Documents')
        }
      ]
    );
  };

  const toggleFlash = () => {
    setFlashMode(
      flashMode === RNCamera.Constants.FlashMode.off
        ? RNCamera.Constants.FlashMode.on
        : flashMode === RNCamera.Constants.FlashMode.on
        ? RNCamera.Constants.FlashMode.auto
        : RNCamera.Constants.FlashMode.off
    );
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case RNCamera.Constants.FlashMode.on:
        return 'flash-on';
      case RNCamera.Constants.FlashMode.auto:
        return 'flash-auto';
      default:
        return 'flash-off';
    }
  };

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={retakePhoto} style={styles.headerButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document Review</Text>
          <TouchableOpacity onPress={saveDocument} style={styles.headerButton}>
            <Icon name="check" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.reviewContainer}>
          <Image source={{ uri: capturedImage.uri || capturedImage.path }} style={styles.capturedImage} />
          
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#0066CC" />
              <Text style={styles.processingText}>Processing document...</Text>
            </View>
          ) : (
            <View style={styles.resultContainer}>
              <View style={styles.documentTypeContainer}>
                <Icon 
                  name={getDocumentIcon(documentType)} 
                  size={30} 
                  color="#0066CC" 
                />
                <Text style={styles.documentType}>
                  {documentType === 'unknown' ? 'Document' : formatDocumentType(documentType)}
                </Text>
              </View>
              
              {extractedText && (
                <View style={styles.extractedInfoContainer}>
                  <Text style={styles.sectionTitle}>Extracted Information</Text>
                  
                  {/* Container Numbers */}
                  {extractedInfo?.containerNumbers?.length > 0 && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Container Numbers:</Text>
                      {extractedInfo.containerNumbers.map((container, index) => (
                        <TouchableOpacity 
                          key={index}
                          style={styles.containerChip}
                          onPress={() => navigation.navigate('Tracking', { containerId: container })}
                        >
                          <Icon name="local-shipping" size={16} color="#0066CC" />
                          <Text style={styles.containerNumber}>{container}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  {/* Dates */}
                  {extractedInfo?.dates?.length > 0 && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Dates Found:</Text>
                      {extractedInfo.dates.map((date, index) => (
                        <Text key={index} style={styles.infoValue}>{date}</Text>
                      ))}
                    </View>
                  )}
                  
                  {/* References */}
                  {extractedInfo?.references?.length > 0 && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Reference Numbers:</Text>
                      {extractedInfo.references.map((ref, index) => (
                        <Text key={index} style={styles.infoValue}>
                          {ref.type}: {ref.value}
                        </Text>
                      ))}
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.viewFullTextButton}
                    onPress={() => Alert.alert('Extracted Text', extractedText)}
                  >
                    <Text style={styles.viewFullTextLabel}>View Full Text</Text>
                    <Icon name="expand-more" size={20} color="#0066CC" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={retakePhoto}>
            <Icon name="camera-alt" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={saveDocument}>
            <Icon name="save" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Save Document</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        captureAudio={false}
        androidCameraPermissionOptions={{
          title: 'Camera Permission',
          message: 'ROOTUIP needs camera access to scan documents',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }}
      >
        {/* Camera Overlay */}
        <View style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.controlButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFlash} style={styles.controlButton}>
              <Icon name={getFlashIcon()} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.frameContainer}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instructionText}>
              Position document within frame
            </Text>
          </View>
          
          <View style={styles.bottomControls}>
            <TouchableOpacity onPress={selectFromGallery} style={styles.galleryButton}>
              <Icon name="photo-library" size={30} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={takePicture} 
              style={styles.captureButton}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setCameraType(
                cameraType === RNCamera.Constants.Type.back
                  ? RNCamera.Constants.Type.front
                  : RNCamera.Constants.Type.back
              )} 
              style={styles.flipButton}
            >
              <Icon name="flip-camera-ios" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </RNCamera>
    </View>
  );
};

// Helper functions
const getDocumentIcon = (type) => {
  const icons = {
    billOfLading: 'local-shipping',
    invoice: 'receipt',
    packingList: 'list-alt',
    customsDeclaration: 'account-balance',
    deliveryNote: 'local-shipping',
    unknown: 'insert-drive-file'
  };
  return icons[type] || 'insert-drive-file';
};

const formatDocumentType = (type) => {
  const names = {
    billOfLading: 'Bill of Lading',
    invoice: 'Invoice',
    packingList: 'Packing List',
    customsDeclaration: 'Customs Declaration',
    deliveryNote: 'Delivery Note'
  };
  return names[type] || 'Document';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 300,
    height: 400,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#0066CC',
    borderWidth: 3,
  },
  topLeft: {
    top: -1,
    left: -1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -1,
    right: -1,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -1,
    left: -1,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -1,
    right: -1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 30,
    paddingHorizontal: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#0066CC',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066CC',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0066CC',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  reviewContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  capturedImage: {
    width: '100%',
    height: 400,
    resizeMode: 'contain',
    backgroundColor: '#000',
  },
  processingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  resultContainer: {
    padding: 20,
  },
  documentTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  documentType: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 15,
    color: '#333',
  },
  extractedInfoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  infoSection: {
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 3,
  },
  containerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  containerNumber: {
    fontSize: 14,
    color: '#0066CC',
    marginLeft: 5,
    fontWeight: '500',
  },
  viewFullTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingVertical: 10,
  },
  viewFullTextLabel: {
    fontSize: 14,
    color: '#0066CC',
    marginRight: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#666',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  primaryButton: {
    backgroundColor: '#0066CC',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default DocumentScanScreen;