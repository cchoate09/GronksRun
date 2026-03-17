import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import gameHtml from './gameHtml';

export default function App() {
  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );
  }, []);

  // Diagnostic: check if gameHtml loaded
  const htmlType = typeof gameHtml;
  const htmlLen = gameHtml ? gameHtml.length : 0;
  const hasScript = gameHtml ? gameHtml.includes('<script>') : false;

  if (!gameHtml || htmlLen < 100) {
    return (
      <View style={[styles.container, {justifyContent:'center',alignItems:'center'}]}>
        <Text style={{color:'red',fontSize:20}}>gameHtml FAILED to load!</Text>
        <Text style={{color:'white',fontSize:14}}>type={htmlType} len={htmlLen}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <WebView
        source={{ html: gameHtml }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        scalesPageToFit={true}
        originWhitelist={['*']}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={(syntheticEvent) => {
          console.warn('WebView error:', syntheticEvent.nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          console.warn('WebView HTTP error:', syntheticEvent.nativeEvent);
        }}
      />
      <Text style={{position:'absolute',bottom:2,left:4,color:'lime',fontSize:10,backgroundColor:'rgba(0,0,0,0.7)',padding:2}}>
        HTML:{htmlLen} hasScript:{hasScript?'Y':'N'} v3
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
});
