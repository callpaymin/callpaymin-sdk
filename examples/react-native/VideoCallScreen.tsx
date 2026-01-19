/**
 * CallPayMin Video Call - React Native Example
 *
 * Prerequisites:
 * 1. npm install @callpaymin/sdk react-native-webrtc
 * 2. Follow react-native-webrtc setup for iOS/Android
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { CallPayMin, CallPayMinWebRTC, Call, CallState } from '@callpaymin/sdk';

// Initialize SDK
const client = new CallPayMin({
  apiKey: 'YOUR_API_KEY', // Replace with your API key
});

interface Props {
  userId: string;
  expertId: string;
  ratePerMinute: number;
  onCallEnd?: (call: Call) => void;
}

export const VideoCallScreen: React.FC<Props> = ({
  userId,
  expertId,
  ratePerMinute,
  onCallEnd,
}) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  const callClientRef = useRef<CallPayMinWebRTC | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (callClientRef.current) {
        callClientRef.current.endCall();
      }
    };
  }, []);

  const startCall = async () => {
    try {
      callClientRef.current = new CallPayMinWebRTC({
        client,
        onLocalStream: (stream) => setLocalStream(stream),
        onRemoteStream: (stream) => setRemoteStream(stream),
        onStateChange: (state) => {
          setCallState(state);
          if (state === 'connected') {
            startTimer();
          }
        },
        onError: (error) => {
          Alert.alert('Error', error.message);
          setCallState('idle');
        },
        onCallEnded: (call) => {
          stopTimer();
          if (call.billing) {
            setTotalCost(call.billing.totalCost);
            setDuration(call.duration || 0);
          }
          onCallEnd?.(call);
        },
      });

      await callClientRef.current.startCall({
        participants: [
          { externalId: userId, displayName: 'You', role: 'client' },
          { externalId: expertId, displayName: 'Expert', role: 'expert' },
        ],
        billing: {
          payerId: userId,
          ratePerMinute,
        },
      });
    } catch (error: any) {
      Alert.alert('Failed to start call', error.message);
    }
  };

  const endCall = async () => {
    if (callClientRef.current) {
      await callClientRef.current.endCall();
      callClientRef.current = null;
    }
  };

  const toggleMute = () => {
    if (callClientRef.current) {
      const newMuted = !isMuted;
      callClientRef.current.toggleAudio(!newMuted);
      setIsMuted(newMuted);
    }
  };

  const toggleVideo = () => {
    if (callClientRef.current) {
      const newVideoOff = !isVideoOff;
      callClientRef.current.toggleVideo(!newVideoOff);
      setIsVideoOff(newVideoOff);
    }
  };

  const switchCamera = async () => {
    if (callClientRef.current) {
      await callClientRef.current.switchCamera();
    }
  };

  const startTimer = () => {
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
      setTotalCost((elapsed / 60) * ratePerMinute);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting';

  return (
    <SafeAreaView style={styles.container}>
      {/* Video Streams */}
      <View style={styles.videoContainer}>
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}

        {localStream && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror
          />
        )}

        {!isConnected && !isConnecting && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Tap "Start Call" to begin
            </Text>
          </View>
        )}
      </View>

      {/* Call Info */}
      <View style={styles.infoBar}>
        <Text style={styles.stateText}>
          {callState.charAt(0).toUpperCase() + callState.slice(1)}
        </Text>
        {isConnected && (
          <>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            <Text style={styles.costText}>${totalCost.toFixed(2)}</Text>
          </>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isConnected && !isConnecting ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={startCall}
          >
            <Text style={styles.buttonText}>Start Call</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, isMuted && styles.activeButton]}
              onPress={toggleMute}
              disabled={!isConnected}
            >
              <Text style={styles.buttonText}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isVideoOff && styles.activeButton]}
              onPress={toggleVideo}
              disabled={!isConnected}
            >
              <Text style={styles.buttonText}>
                {isVideoOff ? 'Video On' : 'Video Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={switchCamera}
              disabled={!isConnected}
            >
              <Text style={styles.buttonText}>Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.endButton]}
              onPress={endCall}
            >
              <Text style={styles.buttonText}>End</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  localVideo: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 8,
    backgroundColor: '#0f0f23',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16213e',
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#16213e',
  },
  stateText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  durationText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  costText: {
    color: '#ffc107',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
  },
  endButton: {
    backgroundColor: '#f44336',
  },
  activeButton: {
    backgroundColor: '#ff9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VideoCallScreen;
