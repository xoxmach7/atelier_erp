import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuthContext } from '../../src/context/AuthContext';
import { createOrder } from '../../src/api/orders';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

interface FormState {
  client_name: string;
  client_phone: string;
  address: string;
  deadline: string;
  comment: string;
}

interface FormErrors {
  client_name?: string;
  client_phone?: string;
  address?: string;
  deadline?: string;
}

export default function NewOrderScreen() {
  const router = useRouter();
  const { primaryRole } = useAuthContext();
  const [form, setForm] = useState<FormState>({
    client_name: '',
    client_phone: '',
    address: '',
    deadline: '',
    comment: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canCreate = primaryRole === 'owner' || primaryRole === 'designer';

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.client_name.trim()) next.client_name = 'Введите имя клиента';
    if (!form.client_phone.trim()) next.client_phone = 'Введите телефон';
    if (!form.address.trim()) next.address = 'Введите адрес';
    if (!form.deadline.trim()) next.deadline = 'Выберите срок';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validate()) return;
    if (!canCreate) {
      setSubmitError('Недостаточно прав для создания заказа');
      return;
    }

    setLoading(true);
    try {
      const order = await createOrder({
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim(),
        address: form.address.trim(),
        deadline: form.deadline,
        comment: form.comment.trim() || undefined,
      });
      // Redirect to order detail
      router.replace(`/orders/${order.id}`);
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as any).message)
        : 'Не удалось создать заказ';
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field !== 'comment' && errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined } as FormErrors));
    }
    setSubmitError(null);
  };

  return (
    <Screen scrollable={false} withPadding={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>Новый заказ</Text>

          <View style={styles.form}>
            {/* Client name */}
            <View style={styles.field}>
              <Text style={styles.label}>Имя клиента <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.client_name && styles.inputError]}
                placeholder="Иван Иванов"
                placeholderTextColor={colors.textMuted}
                value={form.client_name}
                onChangeText={v => updateField('client_name', v)}
                autoCapitalize="words"
              />
              {errors.client_name && <Text style={styles.errorText}>{errors.client_name}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Телефон <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.client_phone && styles.inputError]}
                placeholder="+7 777 123 4567"
                placeholderTextColor={colors.textMuted}
                value={form.client_phone}
                onChangeText={v => updateField('client_phone', v)}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              {errors.client_phone && <Text style={styles.errorText}>{errors.client_phone}</Text>}
            </View>

            {/* Address */}
            <View style={styles.field}>
              <Text style={styles.label}>Адрес <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.address && styles.inputError]}
                placeholder="г. Алматы, ул. Примерная, д. 12"
                placeholderTextColor={colors.textMuted}
                value={form.address}
                onChangeText={v => updateField('address', v)}
              />
              {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
            </View>

            {/* Deadline */}
            <View style={styles.field}>
              <Text style={styles.label}>Срок выполнения <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.deadline && styles.inputError]}
                placeholder="ГГГГ-ММ-ДД"
                placeholderTextColor={colors.textMuted}
                value={form.deadline}
                onChangeText={v => updateField('deadline', v)}
              />
              {errors.deadline && <Text style={styles.errorText}>{errors.deadline}</Text>}
            </View>

            {/* Comment */}
            <View style={styles.field}>
              <Text style={styles.label}>Комментарий</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Примечания к заказу..."
                placeholderTextColor={colors.textMuted}
                value={form.comment}
                onChangeText={v => updateField('comment', v)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Error */}
            {submitError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{submitError}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Создать заказ</Text>
              )}
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  container: {
    padding: spacing.base,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  form: {
    gap: spacing.base,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  required: {
    color: colors.danger.DEFAULT,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger.DEFAULT,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger.DEFAULT,
  },
  errorBox: {
    backgroundColor: colors.danger.light,
    borderRadius: 8,
    padding: spacing.base,
  },
  errorBoxText: {
    fontSize: typography.sizes.sm,
    color: colors.danger.dark,
  },
  submitBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
  },
});
