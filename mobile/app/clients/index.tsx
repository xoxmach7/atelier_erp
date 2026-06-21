import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconButton } from '../../src/components/Icon';
import { EmptyState } from '../../src/components/EmptyState';
import { fetchCustomers, deleteCustomer } from '../../src/api/customers';
import type { Customer } from '../../src/types/customer';

export default function ClientsScreen() {
  const router = useRouter();
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchCustomers();
      setData(res.results);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить клиентов');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? data.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : data;

  const onDelete = (c: Customer) => {
    Alert.alert('Удалить клиента?', c.full_name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          try { await deleteCustomer(c.id); load(); }
          catch (e: any) { Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить'); }
        },
      },
    ]);
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Клиенты</Text>
        <View style={s.iconRow}>
          <IconButton name="plus" onPress={() => router.push('/clients/new')} />
          <IconButton name="search" onPress={() => setShowSearch(v => !v)} />
        </View>
      </View>

      {showSearch && (
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            placeholder="Поиск по имени или телефону..."
            placeholderTextColor="#94A3B8"
            value={search} onChangeText={setSearch} autoFocus
          />
        </View>
      )}

      {loading && <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>}
      {Boolean(error) && !loading && (
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={s.retryBtn}><Text style={s.retryText}>Повторить</Text></TouchableOpacity>
        </View>
      )}
      {!loading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={<EmptyState title="Нет клиентов" subtitle="Добавьте первого клиента" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.full_name}</Text>
                <Text style={s.phone}>{item.phone}</Text>
              </View>
              <View style={s.rowIcons}>
                <IconButton name="edit" size={36} onPress={() => router.push(`/clients/${item.id}`)} />
                <IconButton name="trash" size={36} onPress={() => onDelete(item)} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 20,
    paddingBottom: 12,
  },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  title: { fontSize: 30, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', textAlign: 'center', letterSpacing: -0.5 },
  iconRow: { flexDirection: 'row', gap: 16, marginTop: 14 },

  searchBar: { paddingHorizontal: 20, paddingBottom: 10 },
  searchInput: { backgroundColor: '#F1F3F5', borderRadius: 10, height: 44, paddingHorizontal: 16, fontSize: 15, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },

  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#EEF1F4', backgroundColor: '#FAFBFC',
  },
  name: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  phone: { fontSize: 15, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginTop: 3 },
  rowIcons: { flexDirection: 'row', gap: 12 },
});
