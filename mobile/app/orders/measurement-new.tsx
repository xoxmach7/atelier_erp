import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { AppTextInput } from '../../src/components/AppTextInput';
import { PrimaryButton } from '../../src/components/PrimaryButton';

import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function MeasurementNewScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  // order context available via orderId param

  const [room, setRoom] = useState('');
  const [windowName, setWindowName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [fabric, setFabric] = useState('');
  const [tulle, setTulle] = useState('');
  const [attachment, setAttachment] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (!room || !windowName || !width || !height) {
      Alert.alert('Ошибка', 'Заполните обязательные поля: помещение, окно, ширина, высота');
      return;
    }
    Alert.alert('Демо', 'Замер сохранён (без отправки на сервер)');
    router.back();
  };

  return (
    <Screen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backWrap}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Новый замер</Text>
        {orderId ? <Text style={styles.subtitle}>Заказ #{orderId.slice(-6)}</Text> : null}

        <View style={styles.form}>
          <Text style={styles.label}>Помещение *</Text>
          <AppTextInput placeholder="Например: Гостиная" value={room} onChangeText={setRoom} />

          <Text style={styles.label}>Окно *</Text>
          <AppTextInput placeholder="Например: Балконное" value={windowName} onChangeText={setWindowName} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Ширина, см *</Text>
              <AppTextInput placeholder="350" value={width} onChangeText={setWidth} keyboardType="numeric" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Высота, см *</Text>
              <AppTextInput placeholder="280" value={height} onChangeText={setHeight} keyboardType="numeric" />
            </View>
          </View>

          <Text style={styles.label}>Ткань</Text>
          <AppTextInput placeholder="Например: Велюр серый" value={fabric} onChangeText={setFabric} />

          <Text style={styles.label}>Тюль</Text>
          <AppTextInput placeholder="Например: Органза белая" value={tulle} onChangeText={setTulle} />

          <Text style={styles.label}>Тип крепления</Text>
          <AppTextInput placeholder="Например: Профильный карниз" value={attachment} onChangeText={setAttachment} />

          <Text style={styles.label}>Комментарий</Text>
          <AppTextInput
            placeholder="Дополнительные замечания"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            style={styles.commentInput}
          />

          <View style={styles.actions}>
            <PrimaryButton title="Сохранить замер" onPress={handleSubmit} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing['2xl'],
  },
  backWrap: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  back: {
    fontSize: typography.sizes.sm,
    color: colors.primary[500],
    fontWeight: typography.weights.medium,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  commentInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  actions: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
});
