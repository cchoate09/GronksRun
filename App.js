import { useEffect, useRef, useCallback, useState, Component } from 'react';
import { View, StyleSheet, BackHandler, Text, Vibration, AppState, Dimensions, PanResponder } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Sentry from '@sentry/react-native';
import {
  RewardedInterstitialAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import gameHtml from './assets/gameHtml';

import {
  bootstrapTelemetry,
  captureError,
  initializeTelemetry,
} from './src/telemetry';

bootstrapTelemetry();

const AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED_INTERSTITIAL
  : 'ca-app-pub-8879184280264151/6328191159';

const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(AD_UNIT_ID, {
  requestNonPersonalizedAdsOnly: true,
});

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('App crash caught by ErrorBoundary:', error, errorInfo);
    void captureError(error, {
      source: 'native_error_boundary',
      component_stack: errorInfo?.componentStack || '',
    });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message || 'Unknown error'}</Text>
          <Text style={styles.errorRetry} onPress={() => this.setState({ hasError: false, error: null })}>TAP TO RETRY</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function GameApp() {
  const webViewRef = useRef(null);
  const adLoadedRef = useRef(false);
  const pendingRewardType = useRef(null);
  const appStateRef = useRef(AppState.currentState || 'active');

  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });

  const sendToGame = useCallback((type, data) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type, ...data }));
    }
  }, []);

  const sendWindowMetrics = useCallback(() => {
    const window = Dimensions.get('window');
    sendToGame('windowMetrics', {
      width: window.width,
      height: window.height,
      scale: window.scale || 1,
    });
  }, [sendToGame]);

  const loadAd = useCallback(() => {
    adLoadedRef.current = false;
    try {
      rewardedInterstitial.load();
    } catch (e) {
      console.log('Ad load error:', e);
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const dist = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        const maxDist = 40;
        const moveX = Math.min(dist, maxDist) * (gestureState.dx / dist || 0);
        const moveY = Math.min(dist, maxDist) * (gestureState.dy / dist || 0);
        setJoystick({ x: moveX, y: moveY });
        sendToGame('joystickMove', { x: moveX / maxDist, y: moveY / maxDist });
      },
      onPanResponderRelease: () => {
        setJoystick({ x: 0, y: 0 });
        sendToGame('joystickMove', { x: 0, y: 0 });
      },
    })
  ).current;

  const handleAction = (action) => {
    Vibration.vibrate(10);
    sendToGame('action', { name: action });
  };

  useEffect(() => {
    void initializeTelemetry();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      sendToGame('backButton', {});
      return true;
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      sendToGame('appState', { state: nextState, previousState: prevState });
      if (nextState === 'active') {
        sendWindowMetrics();
        if (!adLoadedRef.current) loadAd();
      }
    });

    const dimensionsSub = Dimensions.addEventListener('change', sendWindowMetrics);

    const onAdLoaded = rewardedInterstitial.addAdEventListener(RewardedAdEventType.LOADED, () => {
      adLoadedRef.current = true;
      sendToGame('adReady', { ready: true });
    });

    const onAdEarned = rewardedInterstitial.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      sendToGame('adRewarded', { rewardType: pendingRewardType.current, amount: reward.amount });
      pendingRewardType.current = null;
    });

    const onAdClosed = rewardedInterstitial.addAdEventListener(AdEventType.CLOSED, () => {
      sendToGame('adClosed', {});
      loadAd();
    });

    const onAdError = rewardedInterstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('Ad error:', error);
      adLoadedRef.current = false;
      setTimeout(loadAd, 30000);
    });

    loadAd();

    return () => {
      backHandler.remove();
      appStateSub.remove();
      dimensionsSub.remove();
      onAdLoaded();
      onAdEarned();
      onAdClosed();
      onAdError();
    };
  }, [loadAd, sendToGame, sendWindowMetrics]);

  const onMessage = useCallback(async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'showAd') {
        pendingRewardType.current = msg.rewardType || 'generic';
        if (adLoadedRef.current) rewardedInterstitial.show();
        else {
          sendToGame('adNotReady', {});
          loadAd();
        }
      } else if (msg.type === 'exitApp') BackHandler.exitApp();
      else if (msg.type === 'haptic') {
        const p = msg.pattern;
        if (Array.isArray(p)) Vibration.vibrate(p);
        else if (p === 'light') Vibration.vibrate(10);
        else if (p === 'medium') Vibration.vibrate(25);
        else if (p === 'heavy') Vibration.vibrate(50);
      }
    } catch (e) {}
  }, [sendToGame, loadAd]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <WebView
        ref={webViewRef}
        source={{ html: gameHtml }}
        style={[styles.webview, { opacity: webViewLoaded ? 1 : 0 }]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        scalesPageToFit={true}
        originWhitelist={['*']}
        scrollEnabled={false}
        onMessage={onMessage}
        androidLayerType="hardware"
        onLoadEnd={() => {
            console.log('WebView load finished');
            setWebViewLoaded(true);
            sendWindowMetrics();
        }}
        onError={(e) => {
            console.error('WebView error:', e.nativeEvent);
        }}
      />

      {!webViewLoaded && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>INITIALIZING ENGINE...</Text>
          <Text style={styles.loadingSubtext}>Booting WebGL Renderer...</Text>
        </View>
      )}

      {webViewLoaded && (
        <View style={styles.controlsLayer} pointerEvents="box-none">
            <View style={styles.joystickContainer} {...panResponder.panHandlers}>
                <View style={styles.joystickBase}>
                    <View style={[styles.joystickStick, { transform: [{ translateX: joystick.x }, { translateY: joystick.y }] }]} />
                </View>
            </View>

            <View style={styles.actionButtonsContainer}>
                <View onTouchStart={() => handleAction('attack')} style={[styles.actionButton, styles.attackButton]}>
                    <Text style={styles.attackText}>ATTACK</Text>
                </View>
            </View>
        </View>
      )}
    </View>
  );
}

function AppRoot() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

export default Sentry.wrap(AppRoot);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a24' },
  loadingContainer: { position: 'absolute', inset: 0, backgroundColor: '#1a1a24', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#4488ff', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  loadingSubtext: { color: '#667788', fontSize: 12, marginTop: 8 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  controlsLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  joystickContainer: { position: 'absolute', left: 28, bottom: 34, width: 150, height: 150, justifyContent: 'center', alignItems: 'center' },
  joystickBase: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  joystickStick: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.4)' },
  actionButtonsContainer: { position: 'absolute', right: 46, bottom: 58, alignItems: 'flex-end' },
  actionButton: { borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  attackButton: { width: 100, height: 100, backgroundColor: 'rgba(255,85,85,0.4)', borderColor: '#ff5555' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  attackText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  errorContainer: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorTitle: { color: '#FF6644', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  errorMessage: { color: '#AABBCC', fontSize: 14, textAlign: 'center', marginBottom: 32, fontFamily: 'monospace' },
  errorRetry: { color: '#44DD66', fontSize: 20, fontWeight: 'bold', padding: 16, borderWidth: 2, borderColor: '#44DD66', borderRadius: 8 },
});
