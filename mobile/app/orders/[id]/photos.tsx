import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../src/components/Screen';
import { useAuthContext } from '../../../src/context/AuthContext';
import {
  fetchPhotoReports, uploadPhotoReport,
  type PhotoReportDTO,
} from '../../../src/api/orders';
import { colors } from '../../../src/theme/colors';
import { spacing, radius } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - spacing.base * 3) / 2;

export default function OrderPhotosScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const orderId = id as string;

  const [photos, setPhotos] = useState<PhotoReportDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = primaryRole === 'installation' || primaryRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPhotoReports(orderId);
      setPhotos(data.photo_reports);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить фото';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePickImage = async () => {
    try {
      const imagePicker = await import('expo-image-picker');
      const result = await imagePicker.launchImageLibraryAsync({
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || 'photo.jpg';
      const match = /\.\w+$/.exec(filename);
      const type = match ? `image/${match[0].substring(1)}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type,
      } as unknown as Blob);
      formData.append('caption', '');

      setUploading(true);
      const uploaded = await uploadPhotoReport(orderId, formData);
      setPhotos(prev => [uploaded, ...prev]);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Ошибка загрузки фото';
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
        <Text style={styles.title}>Фотоотчёт</Text>
      </View>

      {canUpload && (
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
          onPress={handlePickImage}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.uploadBtnText}>📷 Добавить фото</Text>
          )}
        </TouchableOpacity>
      )}

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
        <ScrollView contentContainerStyle={styles.grid}>
          {photos.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Фото ещё не загружены</Text>
            </View>
          ) : (
            photos.map(photo => (
              <View key={photo.id} style={styles.photoCard}>
                <Image
                  source={{ uri: photo.file_url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                {photo.caption ? (
                  <Text style={styles.photoCaption} numberOfLines={2}>{photo.caption}</Text>
                ) : null}
              </View>
            ))
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
  uploadBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    padding: spacing.base,
    margin: spacing.base,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  errorText: { fontSize: typography.sizes.base, color: colors.danger.DEFAULT, textAlign: 'center' },
  retryText: { fontSize: typography.sizes.base, color: colors.primary[500], textDecorationLine: 'underline' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.base,
    gap: spacing.base,
    paddingBottom: 60,
  },
  emptyBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: { fontSize: typography.sizes.base, color: colors.textMuted },
  photoCard: {
    width: PHOTO_SIZE,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photoImage: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.lg,
  },
  photoCaption: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    padding: spacing.sm,
  },
});
