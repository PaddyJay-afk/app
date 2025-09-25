import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
  boat_year: string;
  boat_make: string;
  boat_model: string;
  boat_length: string;
  boat_hin: string;
  engine_type: string;
  engine_serial_number: string;
  engine_year: string;
  engine_make: string;
  engine_model: string;
  engine_horsepower: string;
  engine_hours: string;
  prop_type: 'stainless' | 'aluminum' | 'bronze' | '';
}

const theme = {
  colors: {
    primary: '#D4AF37',
    secondary: '#E8B4CB',
    accent: '#8A2BE2',
    background: '#1A1A1A',
    surface: '#2D2D2D',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    border: '#3D3D3D',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  }
};

const propTypes = [
  { label: 'Select Prop Type', value: '' },
  { label: 'Stainless Steel', value: 'stainless' },
  { label: 'Aluminum', value: 'aluminum' },
  { label: 'Bronze', value: 'bronze' },
];

export default function AddCustomerScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [showPropPicker, setShowPropPicker] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormData>({
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      boat_year: '',
      boat_make: '',
      boat_model: '',
      boat_length: '',
      boat_hin: '',
      engine_type: '',
      engine_serial_number: '',
      engine_year: '',
      engine_make: '',
      engine_model: '',
      engine_horsepower: '',
      engine_hours: '',
      prop_type: '',
    }
  });

  const onSubmit = async (data: CustomerFormData) => {
    setLoading(true);
    try {
      const customerData = {
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        boat: {
          year: data.boat_year || null,
          make: data.boat_make || null,
          model: data.boat_model || null,
          length: data.boat_length || null,
          hin: data.boat_hin || null,
        },
        engine: {
          engine_type: data.engine_type || null,
          serial_number: data.engine_serial_number || null,
          year: data.engine_year || null,
          make: data.engine_make || null,
          model: data.engine_model || null,
          horsepower: data.engine_horsepower || null,
          hours: data.engine_hours || null,
        },
        prop_type: data.prop_type || null,
      };

      const response = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'Customer added successfully!',
          [
            {
              text: 'Add Another',
              onPress: () => reset(),
            },
            {
              text: 'View Customers',
              onPress: () => navigation.navigate('Customers'),
            },
          ]
        );
      } else {
        throw new Error('Failed to add customer');
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      Alert.alert('Error', 'Failed to add customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    name: keyof CustomerFormData,
    placeholder: string,
    rules?: any,
    keyboardType?: any
  ) => (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value } }) => (
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              errors[name] && styles.inputError
            ]}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            keyboardType={keyboardType || 'default'}
          />
          {errors[name] && (
            <Text style={styles.errorText}>{errors[name]?.message}</Text>
          )}
        </View>
      )}
    />
  );

  const renderPropTypePicker = () => (
    <Controller
      control={control}
      name="prop_type"
      render={({ field: { onChange, value } }) => (
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowPropPicker(!showPropPicker)}
          >
            <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
              {value ? propTypes.find(p => p.value === value)?.label : 'Select Prop Type'}
            </Text>
            <Ionicons
              name={showPropPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
          
          {showPropPicker && (
            <View style={styles.dropdown}>
              {propTypes.map((prop) => (
                <TouchableOpacity
                  key={prop.value}
                  style={[
                    styles.dropdownOption,
                    value === prop.value && styles.selectedOption
                  ]}
                  onPress={() => {
                    onChange(prop.value);
                    setShowPropPicker(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownOptionText,
                    value === prop.value && styles.selectedOptionText
                  ]}>
                    {prop.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Customer</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            {renderInput('name', 'Customer Name *', { required: 'Name is required' })}
            {renderInput('phone', 'Phone Number', {}, 'phone-pad')}
            {renderInput('address', 'Address')}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Boat Information</Text>
            {renderInput('boat_year', 'Boat Year', {}, 'numeric')}
            {renderInput('boat_make', 'Boat Make')}
            {renderInput('boat_model', 'Boat Model')}
            {renderInput('boat_length', 'Boat Length')}
            {renderInput('boat_hin', 'Boat HIN')}
            {renderPropTypePicker()}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Engine Information</Text>
            {renderInput('engine_type', 'Engine Type')}
            {renderInput('engine_serial_number', 'Engine Serial Number')}
            {renderInput('engine_year', 'Engine Year', {}, 'numeric')}
            {renderInput('engine_make', 'Engine Make')}
            {renderInput('engine_model', 'Engine Model')}
            {renderInput('engine_horsepower', 'Engine Horsepower', {}, 'numeric')}
            {renderInput('engine_hours', 'Engine Hours', {}, 'numeric')}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Adding Customer...' : 'Add Customer'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 48,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  dropdownButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  placeholderText: {
    color: theme.colors.textSecondary,
  },
  dropdown: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedOption: {
    backgroundColor: theme.colors.primary + '20',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
});