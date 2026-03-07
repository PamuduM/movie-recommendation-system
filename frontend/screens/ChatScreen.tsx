import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '../hooks/use-color-scheme';

import { useAuth } from '../contexts/AuthContext';
import { fetchChatContacts, fetchChatThread, sendChatMessage } from '../services/api';

type Contact = {
  id: number;
  username: string;
  avatar?: string | null;
  bio?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
};

type ThreadMessage = {
  id: number;
  senderId: number;
  receiverId: number;
  message: string;
  createdAt: string;
  sender?: { id: number; username: string; avatar?: string | null };
  receiver?: { id: number; username: string; avatar?: string | null };
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function ChatScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const colorScheme = useColorScheme();
  const binaryTextColor = colorScheme === 'dark' ? '#ffffff' : '#000000';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const flatRef = useRef<FlatList<ThreadMessage> | null>(null);

  const loadContacts = useCallback(
    async (query?: string) => {
      setContactsLoading(true);
      setContactsError(null);
      try {
        const data: Contact[] = await fetchChatContacts(
          query && query.trim().length ? query : undefined
        );
        setContacts(data);
        if (!data.length) {
          setSelectedContactId(null);
        } else if (!selectedContactId || !data.some((item) => item.id === selectedContactId)) {
          setSelectedContactId(data[0].id);
        }
      } catch (error) {
        setContactsError('Failed to load followers. Pull to refresh.');
      } finally {
        setContactsLoading(false);
      }
    },
    [selectedContactId]
  );

  const loadThread = useCallback(
    async (contactId: number) => {
      if (!userId) return;
      setThreadLoading(true);
      setThreadError(null);
      try {
        const data: ThreadMessage[] = await fetchChatThread(userId, contactId);
        setThread(data);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
      } catch (error) {
        setThreadError('Failed to load conversation.');
        setThread([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    const handle = setTimeout(() => {
      loadContacts(searchTerm);
    }, 250);
    return () => clearTimeout(handle);
  }, [userId, searchTerm, loadContacts]);

  useEffect(() => {
    if (selectedContactId) {
      loadThread(selectedContactId);
    } else {
      setThread([]);
    }
  }, [selectedContactId, loadThread]);

  const handleSend = async () => {
    if (!selectedContactId) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    setThreadError(null);
    try {
      await sendChatMessage(selectedContactId, trimmed);
      setMessage('');
      await Promise.all([loadThread(selectedContactId), loadContacts(searchTerm)]);
    } catch (error) {
      setThreadError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const isSelected = item.id === selectedContactId;
    const initials = item.username.slice(0, 2).toUpperCase();
    return (
      <TouchableOpacity
        onPress={() => setSelectedContactId(item.id)}
        style={[styles.contactRow, isSelected ? styles.contactRowActive : null]}
      >
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.contactAvatar} />
        ) : (
          <View style={styles.contactAvatarPlaceholder}>
            <Text style={styles.contactAvatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.contactMeta}>
          <View style={styles.contactTitleRow}>
            <Text style={styles.contactName}>{item.username}</Text>
            <Text style={styles.contactTime}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <Text style={styles.contactLast} numberOfLines={1}>
            {item.lastMessage || item.bio || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: ThreadMessage }) => {
    const isMe = item.senderId === userId;
    const partnerAvatar = isMe ? user?.avatar : selectedContact?.avatar;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={styles.msgAvatarSlot}>
            {partnerAvatar ? (
              <Image source={{ uri: partnerAvatar }} style={styles.msgAvatar} />
            ) : (
              <View style={styles.msgAvatarPlaceholder}>
                <Text style={styles.msgAvatarInitials}>{selectedContact?.username.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={styles.msgText}>{item.message}</Text>
          <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Log in to chat with your followers.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={96}
    >
      <View style={styles.contactsPanel}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search followers"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {contactsLoading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : contactsError ? (
          <Text style={styles.errorText}>{contactsError}</Text>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderContact}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.muted}>Follow users to start chatting.</Text>}
          />
        )}
      </View>

      <View style={styles.threadPanel}>
        {selectedContact ? (
          <>
            <View style={styles.threadHeader}>
              <Text style={styles.threadTitle}>{selectedContact.username}</Text>
              <Text style={styles.threadSubtitle}>{selectedContact.bio || 'Follower'}</Text>
            </View>
            {threadLoading ? (
              <ActivityIndicator style={styles.loadingIndicator} />
            ) : threadError ? (
              <Text style={styles.errorText}>{threadError}</Text>
            ) : (
              <FlatList
                ref={flatRef}
                data={thread}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.threadList}
              />
            )}

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message"
                editable={!sending}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!message.trim() || sending}
              >
                <Text style={[styles.sendTxt, { color: binaryTextColor }]}>{sending ? 'Sending…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.muted}>Select a follower to start chatting.</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 12, gap: 12 },
  contactsPanel: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 12,
    maxHeight: 240,
    minHeight: 160,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  loadingIndicator: { marginVertical: 16 },
  errorText: { color: '#b00020', textAlign: 'center', marginVertical: 8 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 6 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12 },
  contactRowActive: { backgroundColor: '#e6f0ff' },
  contactAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  contactAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#dfe3eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: { color: '#4d5b76', fontWeight: '700' },
  contactMeta: { flex: 1 },
  contactTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  contactName: { fontWeight: '700', fontSize: 15, color: '#111' },
  contactTime: { fontSize: 11, color: '#666' },
  contactLast: { color: '#555', fontSize: 13 },
  threadPanel: {
    flex: 1,
    backgroundColor: '#fdfdfd',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f1f1',
  },
  threadHeader: { marginBottom: 8 },
  threadTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  threadSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  threadList: { paddingBottom: 80 },
  msgRow: { flexDirection: 'row', marginVertical: 4 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgAvatarSlot: { width: 36, marginRight: 6, alignItems: 'flex-end' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16 },
  msgAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarInitials: { fontSize: 11, fontWeight: '700', color: '#555' },
  bubble: { maxWidth: '78%', padding: 10, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#d1f8c0', borderBottomRightRadius: 4, marginLeft: 40 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#eee', marginRight: 40 },
  msgText: { fontSize: 15, color: '#111' },
  msgTime: { fontSize: 11, color: '#666', marginTop: 6, textAlign: 'right' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#eee', paddingTop: 8, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 96,
    backgroundColor: '#fff',
  },
  sendBtn: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#aac8ff' },
  sendTxt: { fontWeight: '700' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#777', textAlign: 'center' },
});

export default ChatScreen;
