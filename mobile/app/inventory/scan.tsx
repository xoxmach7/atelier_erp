import { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { fetchInventoryItemById, type InventoryItem } from '../../src/api/inventory';
import { parseInventoryQrValue } from '../../src/lib/inventoryQr';
import { InventoryQrCard } from '../../src/components/inventory/InventoryQrCard';

type State =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'result'; item: InventoryItem }
  | { kind: 'error'; message: string };

export default function ScanInventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const scanLockRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      scanLockRef.current = false;
      setState({ kind: 'scanning' });
    }, [])
  );

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setState({ kind: 'loading' });

      const id = parseInventoryQrValue(data);
      if (!id) {
        setState({ kind: 'error', message: 'Это не QR материала.' });
        return;
      }

      try {
        const item = await fetchInventoryItemById(id);
        setState({ kind: 'result', item });
      } catch (e: any) {
        setState({
          kind: 'error',
          message:
            e?.status === 404
              ? 'Позиция не найдена — возможно, удалена.'
              : e?.message ?? 'Не удалось загрузить материал',
        });
      }
    },
    []
  );

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Скан материала</Text>
        <View style={{ width: 60 }} />
      </View>

      {state.kind === 'scanning' &&
        (!permission ? (
          <View style={s.centered}>
            <ActivityIndicator color="#60CCED" size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={s.centered}>
            <Text style={s.permissionText}>Нужен доступ к камере, чтобы сканировать QR.</Text>
            <TouchableOpacity style={s.retryBtn} onPress={requestPermission}>
              <Text style={s.retryText}>Разрешить</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScanned}
          />
        ))}

      {state.kind === 'loading' && (
        <View style={s.centered}>
          <ActivityIndicator color="#60CCED" size="large" />
        </View>
      )}

      {state.kind === 'result' && (
        <View>
          <InventoryQrCard item={state.item} />
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => {
              scanLockRef.current = false;
              setState({ kind: 'scanning' });
            }}
          >
            <Text style={s.retryText}>Сканировать ещё раз</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={s.centered}>
          <Text style={s.errorText}>{state.message}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => {
              scanLockRef.current = false;
              setState({ kind: 'scanning' });
            }}
          >
            <Text style={s.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  title: { fontSize: 20, fontFamily: 'TTNormsPro-Regular', color: '#0F172A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  camera: { flex: 1 },
  permissionText: {
    fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 16,
    fontFamily: 'TTNormsPro-Regular',
  },
  errorText: {
    fontSize: 15, color: '#EF4444', textAlign: 'center', marginBottom: 16,
    fontFamily: 'TTNormsPro-Regular',
  },
  retryBtn: {
    alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#60CCED', borderRadius: 10, marginTop: 12,
  },
  retryText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'TTNormsPro-Medium' },
});
