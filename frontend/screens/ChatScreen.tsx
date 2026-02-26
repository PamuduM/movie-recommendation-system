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
  Image,
} from 'react-native';
import { socket } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

type ChatMessage = { message: string; user?: string; ts?: number };

const ChatScreen = () => {
  const { user } = useAuth();
  const username = user?.username || 'Anonymous';

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null); // null = Everyone
  const [selectedView, setSelectedView] = useState<'all' | 'dm'>('all');
  const flatRef = useRef<FlatList<ChatMessage> | null>(null);

  useEffect(() => {
    // announce presence (best-effort)
    socket.emit('user joined', { user: username });

    // receive online user list
    socket.on('users', (list: string[]) => {
      setOnlineUsers(list || []);
    });

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
    socket.off('users');
    };
  }, [username]);

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const payload: ChatMessage & { to?: string } = { message: trimmed, user: username, ts: Date.now() };
    if (selectedUser) payload.to = selectedUser;
    socket.emit('chat message', payload);
    setMessages((prev) => [...prev, payload]);
    setMessage('');
    // scroll to bottom after a small delay
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isSystem = item.user === 'system';
    const isMe = item.user && item.user === username;
    const avatarUri = !isSystem && item.user === username ? (user?.avatar || null) : null;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && !isSystem && (
          <View style={styles.msgAvatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarSmall} />
            ) : (
              <View style={styles.avatarPlaceholderSmall}><Text style={styles.avatarInitialsSmall}>{(item.user||'U').slice(0,2).toUpperCase()}</Text></View>
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : isSystem ? styles.bubbleSystem : styles.bubbleOther]}>
          {!isMe && !isSystem && <Text style={styles.sender}>{item.user}</Text>}
          <Text style={styles.msgText}>{item.message}</Text>
          {('to' in item) && item['to'] ? <Text style={styles.toLabel}>to {item['to']}</Text> : null}
          <Text style={styles.ts}>{new Date(item.ts || Date.now()).toLocaleTimeString()}</Text>
        </View>
        {isMe && !isSystem && (
          <View style={styles.msgAvatarWrapRight}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarSmall} />
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <FlatList
        ref={flatRef}
        data={
          selectedUser
            ? messages.filter(
                (m) =>
                  m.user === 'system' ||
                  (m.user === username && (m as any).to === selectedUser) ||
                  (m.user === selectedUser && ((m as any).to === username || !(m as any).to)) ||
                  false
              )
            : messages
        }
        renderItem={renderItem}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
      />

      {/* online users */}
      <View style={styles.userList}>
        <FlatList
          horizontal
          data={[null, ...onlineUsers.filter((u) => u !== username)]}
          keyExtractor={(u, i) => (u ?? 'everyone') + i}
          renderItem={({ item }) => {
            const isEveryone = item === null;
            const name = isEveryone ? 'Everyone' : (item as string);
            const selected = (selectedUser === null && isEveryone) || selectedUser === item;
            const initials = isEveryone ? 'E' : (item as string).split(' ').map((s) => s[0]).join('').slice(0,2).toUpperCase();
            return (
              <TouchableOpacity
                onPress={() => {
                  if (isEveryone) {
                    setSelectedUser(null);
                    setSelectedView('all');
                  } else {
                    setSelectedUser(item as string);
                    setSelectedView('dm');
                  }
                }}
                style={[styles.userPill, selected ? styles.userPillSelected : null]}
              >
                {(item === username && user?.avatar) ? (
                  <Image source={{ uri: user.avatar }} style={[styles.avatar, selected ? styles.avatarSelected : null]} />
                ) : (
                  <View style={[styles.avatar, selected ? styles.avatarSelected : null]}>
                    <Text style={[styles.avatarText, selected ? styles.userPillTextSelected : null]}>{initials}</Text>
                  </View>
                )}
                <Text style={[styles.userPillText, selected ? styles.userPillTextSelected : null]}>{name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder={selectedUser ? `Message @${selectedUser}` : 'Type a message...'}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={[styles.sendBtn, selectedUser ? styles.sendBtnPrivate : null]} onPress={sendMessage}>
          <Text style={styles.sendTxt}>{selectedUser ? `Send to ${selectedUser}` : 'Send'}</Text>
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
  userList: { position: 'absolute', left: 12, right: 12, bottom: 64, height: 40 },
  userPill: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f0f0f0', borderRadius: 20, marginRight: 8 },
  userPillSelected: { backgroundColor: '#007AFF' },
  userPillText: { color: '#333', fontWeight: '600' },
  userPillTextSelected: { color: '#fff' },
  toLabel: { fontSize: 11, color: '#555', marginTop: 4 },
  sendBtnPrivate: { backgroundColor: '#34c759' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholderSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  avatarInitialsSmall: { fontSize: 12, fontWeight: '700', color: '#666' },
  msgAvatarWrap: { width: 40, alignItems: 'center', justifyContent: 'flex-end', marginRight: 6 },
  msgAvatarWrapRight: { width: 40, alignItems: 'center', justifyContent: 'flex-start', marginLeft: 6 },
});

export default ChatScreen;
