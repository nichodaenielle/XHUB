import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth.store';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const channels = [
    { id: '1', name: 'general', unread: 0 },
    { id: '2', name: 'announcements', unread: 3 },
    { id: '3', name: 'random', unread: 0 },
  ];

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/login');
  };

  const renderChannel = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.channelItem}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View style={styles.channelInfo}>
        <Text style={styles.channelHash}>#</Text>
        <Text style={styles.channelName}>{item.name}</Text>
      </View>
      {item.unread > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>XHUB</Text>
        <Text style={styles.subtitle}>{user?.displayName || user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Channels</Text>
        <FlatList
          data={channels}
          renderItem={renderChannel}
          keyExtractor={(item) => item.id}
          style={styles.channelList}
        />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  channelList: {
    flex: 1,
  },
  channelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelHash: {
    color: '#666',
    marginRight: 8,
  },
  channelName: {
    fontSize: 16,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    margin: 20,
    padding: 16,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
