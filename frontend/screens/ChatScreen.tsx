import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { socket } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

type ChatMessage = { message: string; user?: string; ts?: number };

const ChatScreen = () => {
  const { user } = useAuth();
  const username = user?.username || 'Anonymous';

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const flatRef = useRef<FlatList<ChatMessage> | null>(null);

  useEffect(() => {
    // announce presence (best-effort)
    socket.emit('user joined', { user: username });

    socket.on('chat message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, { ...msg, ts: msg.ts || Date.now() }]);
    });

    // show user joins (server may ignore)
    socket.on('user joined', (payload: any) => {
      setMessages((prev) => [...prev, { message: `${payload.user} joined`, user: 'system', ts: Date.now() }]);
    });

    return () => {
      socket.off('chat message');
      socket.off('user joined');
    };
  }, [username]);

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const payload: ChatMessage = { message: trimmed, user: username, ts: Date.now() };
    socket.emit('chat message', payload);
    setMessages((prev) => [...prev, payload]);
    setMessage('');
    // scroll to bottom after a small delay
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isSystem = item.user === 'system';
    const isMe = item.user && item.user === username;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : isSystem ? styles.bubbleSystem : styles.bubbleOther]}>
          {!isMe && !isSystem && <Text style={styles.sender}>{item.user}</Text>}
          <Text style={styles.msgText}>{item.message}</Text>
          <Text style={styles.ts}>{new Date(item.ts || Date.now()).toLocaleTimeString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <FlatList
        ref={flatRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendTxt}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  listContent: { padding: 12, paddingBottom: 80 },
  msgRow: { marginVertical: 6, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 12 },
  bubbleMe: { backgroundColor: '#007AFF', borderTopRightRadius: 2 },
  bubbleOther: { backgroundColor: '#E5E5EA' },
  bubbleSystem: { backgroundColor: '#FFF3CD' },
  sender: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#333' },
  msgText: { color: '#000' },
  ts: { fontSize: 10, color: '#666', marginTop: 6, alignSelf: 'flex-end' },
  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  sendBtn: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, justifyContent: 'center' },
  sendTxt: { color: '#fff', fontWeight: '600' },
});

export default ChatScreen;
