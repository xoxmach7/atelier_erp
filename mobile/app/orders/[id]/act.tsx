import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../src/components/Screen';
import { useAuthContext } from '../../../src/context/AuthContext';
import {
  fetchCompletionAct, createCompletionAct, uploadSignedAct,
  type CompletionActResponse,
} from '../../../src/api/orders';
import { colors } from '../../../src/theme/colors';
import { spacing, radius } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

export default function OrderActScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const orderId = id as string;

  const [actData, setActData] = useState<CompletionActResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = primaryRole === 'installation' || primaryRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompletionAct(orderId);
      setActData(data);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить АВР';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await createCompletionAct(orderId);
      setActData(data);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось создать АВР';
      Alert.alert('Ошибка', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleUploadSigned = async () => {
    try {
      const imagePicker = await import('expo-image-picker');
      const result = await imagePicker.launchImageLibraryAsync({
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || 'signed.jpg';
      const match = /\.\w+$/.exec(filename);
      const type = match ? `image/${match[0].substring(1)}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('signed_file', {
        uri: asset.uri,
        name: filename,
        type,
      } as unknown as Blob);
      formData.append('notes', '');

      setUploading(true);
      const res = await uploadSignedAct(orderId, formData);
      if (res.act) {
        setActData(prev => prev ? { ...prev, exists: true, status: res.act!.status, act: res.act } : null);
      }
      Alert.alert('Готово', 'Подписанный АВР загружен');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Ошибка загрузки';
      Alert.alert('Ошибка', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen scrollable={false} withPadding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>АВР</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: spacing.base }}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {actData && !actData.exists && actData.status === 'not_available' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>АВР недоступен</Text>
              <Text style={styles.cardText}>{actData.message || 'АВР доступен после установки / выдачи'}</Text>
            </View>
          )}

          {actData && !actData.exists && actData.status === 'not_created' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>АВР ещё не создан</Text>
              {canEdit ? (
                <TouchableOpacity
                  style={[styles.btn, creating && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                  activeOpacity={0.8}
                >
                  {creating ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.btnText}>Создать АВР</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={styles.cardText}>АВР ещё не создан</Text>
              )}
            </View>
          )}

          {actData && actData.exists && actData.act && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{actData.act.act_number}</Text>
              <Text style={styles.cardRow}>Статус: {actData.act.status_label}</Text>
              {actData.act.notes ? <Text style={styles.cardRow}>Примечания: {actData.act.notes}</Text> : null}

              {actData.act.signed_file_url ? (
                <View style={styles.signedSection}>
                  <Text style={styles.sectionTitle}>Подписанный АВР</Text>
                  <Image source={{ uri: actData.act.signed_file_url }} style={styles.signedImage} resizeMode="contain" />
                </View>
              ) : (
                <View style={styles.signedSection}>
                  <Text style={styles.sectionTitle}>Подписанный АВР не загружен</Text>
                  {canEdit && (
                    <TouchableOpacity
                      style={[styles.btn, uploading && styles.btnDisabled]}
                      onPress={handleUploadSigned}
                      disabled={uploading}
                      activeOpacity={0.8}
                    >
                      {uploading ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.btnText}>📄 Загрузить фото АВР</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  back: { fontSize: typography.sizes.base, color: colors.primary[500] },
  title: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text, flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  errorText: { fontSize: typography.sizes.base, color: colors.danger.DEFAULT, textAlign: 'center' },
  retryText: { fontSize: typography.sizes.base, color: colors.primary[500], textDecorationLine: 'underline' },
  scrollContent: { padding: spacing.base, paddingBottom: 60, gap: spacing.base },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.text },
  cardText: { fontSize: typography.sizes.base, color: colors.textMuted },
  cardRow: { fontSize: typography.sizes.base, color: colors.text },
  btn: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
  signedSection: { marginTop: spacing.base, gap: spacing.sm },
  sectionTitle: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.textMuted },
  signedImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
});
