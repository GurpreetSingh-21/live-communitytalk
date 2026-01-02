import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { useSocket } from '@/src/context/SocketContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api/api';

export default function SocketTestScreen() {
  const insets = useSafeAreaInsets();
  const { socket, socketConnected } = useSocket() as any;
  const [logs, setLogs] = useState<string[]>([]);
  const [manualRoom, setManualRoom] = useState("");
  
  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    addLog(`Define Effect: Socket=${!!socket}, Connected=${socketConnected}`);
    
    if (!socket) return;

    const onConnect = () => addLog("✅ Connected event fired");
    const onDisconnect = () => addLog("⚠️ Disconnect event fired");
    const onAny = (event: string, ...args: any[]) => {
      addLog(`📩 Event: ${event}`);
      console.log('Socket Event:', event, args);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.onAny?.(onAny); // catch-all if available, otherwise manual

    // Listen to specific ones we care about
    socket.on('receive_message', (p: any) => addLog(`💬 receive_message: ${p.content} (cid=${p.communityId})`));
    socket.on('pong', (ls: number) => addLog(`🏓 Pong: ${ls}ms`));

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.offAny?.(onAny);
      socket.off('receive_message');
    };
  }, [socket, socketConnected]);

  const handleManualJoin = () => {
    if (!socket) return addLog("❌ No socket instance");
    addLog(`➡ Emitting community:join ${manualRoom}`);
    socket.emit('community:join', manualRoom);
  };

  const handlePing = () => {
     if (!socket) return addLog("❌ No socket instance");
     const start = Date.now();
     socket.emit('ping', () => {
       addLog(`✅ Ping ack received in ${Date.now() - start}ms`);
     });
  };

  const handleApiCheck = async () => {
    try {
      addLog("🌐 Checking API /health...");
      const res = await api.get('/health');
      addLog(`✅ API OK: ${JSON.stringify(res.data)}`);
    } catch (e: any) {
      addLog(`❌ API Fail: ${e.message}`);
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#f2f2f7' }}>
      <Stack.Screen options={{ title: "Socket Diagnostics" }} />
      
      <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#ddd' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Status: {socketConnected ? "🟢 Connected" : "🔴 Disconnected"}
        </Text>
        <Text style={{ fontFamily: 'Courier', fontSize: 12, color: '#555' }}>
          ID: {socket?.id || "null"}
        </Text>
        
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={handlePing} style={{ backgroundColor: '#007AFF', padding: 8, borderRadius: 8 }}>
            <Text style={{ color: 'white' }}>Ping Socket</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleApiCheck} style={{ backgroundColor: '#5856D6', padding: 8, borderRadius: 8 }}>
            <Text style={{ color: 'white' }}>Check API</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <TextInput 
            style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 8 }}
            placeholder="Community ID"
            value={manualRoom}
            onChangeText={setManualRoom}
          />
          <TouchableOpacity onPress={handleManualJoin} style={{ backgroundColor: '#34C759', padding: 8, borderRadius: 8 }}>
            <Text style={{ color: 'white' }}>Join Room</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Event Log:</Text>
        {logs.map((L, i) => (
          <Text key={i} style={{ fontFamily: 'Courier', fontSize: 11, marginBottom: 4, color: '#333' }}>
            {L}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
