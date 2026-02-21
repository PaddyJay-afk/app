import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import type { RegisterOptions } from 'react-hook-form';
import type { KeyboardTypeOptions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// --- Design Tokens ---

const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

const typography = {
  fontFamily: {
    mono: 'SpaceMono',
  },
  size: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

const colors = {
  primary: '#D4AF37',
  primaryDark: '#B8962E',
  background: '#0A0E1A',
  surface: 'rgba(255,255,255,0.08)',
  surfaceBorder: 'rgba(255,255,255,0.12)',
  elevated: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  textSecondary: '#A0A8B8',
  textMuted: '#6B7280',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  pending: '#FF9800',
  inProgress: '#2196F3',
  completed: '#4CAF50',
  tabBarActive: '#D4AF37',
  tabBarInactive: '#6B7280',
} as const;

// --- Type Interfaces ---

interface ScreenNavigation {
  navigate: (screen: string) => void;
  goBack: () => void;
}

interface SettingOption {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  boat: {
    year?: string;
    make?: string;
    model?: string;
    length?: string;
    hin?: string;
  };
  engine: {
    engine_type?: string;
    serial_number?: string;
    year?: string;
    make?: string;
    model?: string;
    horsepower?: string;
    hours?: string;
  };
  prop_type?: 'stainless' | 'aluminum' | 'bronze';
  images: Array<{
    id: string;
    base64_data: string;
    description?: string;
    timestamp: string;
  }>;
  jobs: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    created_at: string;
    updated_at: string;
  }>;
  notes: Array<{
    id: string;
    content: string;
    author: string;
    timestamp: string;
  }>;
  last_activity: string;
}

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

const propTypes = [
  { label: 'Select Prop Type', value: '' },
  { label: 'Stainless Steel', value: 'stainless' },
  { label: 'Aluminum', value: 'aluminum' },
  { label: 'Bronze', value: 'bronze' },
];

// --- Reusable Components ---

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const PressableScale = ({
  children,
  onPress,
  style,
  disabled,
  haptic = true,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object | object[];
  disabled?: boolean;
  haptic?: boolean;
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      onPress={() => {
        if (haptic && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.();
      }}
      activeOpacity={0.9}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
};

const GlassCard = ({
  children,
  style,
  intensity = 25,
  cardRadius = radius.lg,
}: {
  children: React.ReactNode;
  style?: object;
  intensity?: number;
  cardRadius?: number;
}) => (
  <View style={[{
    borderRadius: cardRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  }, style]}>
    {Platform.OS === 'web' ? (
      <View style={{
        padding: spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}>
        {children}
      </View>
    ) : (
      <BlurView
        intensity={intensity}
        tint="dark"
        style={{ padding: spacing.lg }}
      >
        {children}
      </BlurView>
    )}
  </View>
);

const LoadingPulse = () => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.centerContent}>
      <Animated.View style={animatedStyle}>
        <Ionicons name="boat" size={spacing['5xl']} color={colors.primary} />
      </Animated.View>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
};

// --- Screen Components ---

function AddCustomerScreen({ navigation }: { navigation: ScreenNavigation }) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'Customer added successfully!',
          [
            { text: 'Add Another', onPress: () => reset() },
            { text: 'View Customers', onPress: () => navigation.navigate('Customers') },
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
    rules?: RegisterOptions<CustomerFormData>,
    keyboardType?: KeyboardTypeOptions
  ) => (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value } }) => (
        <View style={styles.inputContainer}>
          <View style={[styles.inputWrapper, errors[name] && styles.inputErrorBorder]}>
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType={keyboardType ?? 'default'}
            />
          </View>
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
              size={spacing.xl}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showPropPicker && (
            <View style={styles.dropdownWrapper}>
              {propTypes.map((prop) => (
                <TouchableOpacity
                  key={prop.value || 'empty'}
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

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeaderRow}>
      <LinearGradient
        colors={[colors.primary, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionAccentLine}
      />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={spacing['2xl']} color={colors.text} />
          </PressableScale>
          <Text style={styles.title}>Add Customer</Text>
          <View style={styles.placeholder} />
          <LinearGradient
            colors={[withAlpha(colors.primary, 0.4), 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerBorderGradient}
          />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {renderSectionHeader('Customer Information')}
            {renderInput('name', 'Customer Name *', { required: 'Name is required' })}
            {renderInput('phone', 'Phone Number', undefined, 'phone-pad')}
            {renderInput('address', 'Address')}
          </View>

          <View style={styles.section}>
            {renderSectionHeader('Boat Information')}
            {renderInput('boat_year', 'Boat Year', undefined, 'numeric')}
            {renderInput('boat_make', 'Boat Make')}
            {renderInput('boat_model', 'Boat Model')}
            {renderInput('boat_length', 'Boat Length')}
            {renderInput('boat_hin', 'Boat HIN')}
            {renderPropTypePicker()}
          </View>

          <View style={styles.section}>
            {renderSectionHeader('Engine Information')}
            {renderInput('engine_type', 'Engine Type')}
            {renderInput('engine_serial_number', 'Engine Serial Number')}
            {renderInput('engine_year', 'Engine Year', undefined, 'numeric')}
            {renderInput('engine_make', 'Engine Make')}
            {renderInput('engine_model', 'Engine Model')}
            {renderInput('engine_horsepower', 'Engine Horsepower', undefined, 'numeric')}
            {renderInput('engine_hours', 'Engine Hours', undefined, 'numeric')}
          </View>

          <PressableScale
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            style={loading ? { opacity: 0.6 } : undefined}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Adding Customer...' : 'Add Customer'}
              </Text>
            </LinearGradient>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SettingsScreen() {
  const settingsOptions: SettingOption[] = [
    {
      title: 'About',
      subtitle: 'App version and information',
      icon: 'information-circle',
      onPress: () => {},
    },
    {
      title: 'Export Data',
      subtitle: 'Export customer data',
      icon: 'download',
      onPress: () => {},
    },
    {
      title: 'Backup',
      subtitle: 'Backup and restore data',
      icon: 'cloud-upload',
      onPress: () => {},
    },
    {
      title: 'Support',
      subtitle: 'Get help and support',
      icon: 'help-circle',
      onPress: () => {},
    },
  ];

  const renderSettingOption = (option: SettingOption) => (
    <PressableScale key={option.title} onPress={option.onPress}>
      <GlassCard style={styles.optionCardOuter} intensity={20}>
        <View style={styles.optionRow}>
          <View style={styles.optionIcon}>
            <Ionicons name={option.icon} size={spacing['2xl']} color={colors.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={spacing.xl} color={colors.textSecondary} />
        </View>
      </GlassCard>
    </PressableScale>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.4), 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerBorderGradient}
        />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <LinearGradient
                colors={[colors.primary, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionAccentLine}
              />
              <Text style={styles.sectionTitle}>General</Text>
            </View>
            {settingsOptions.map(renderSettingOption)}
          </View>

          <GlassCard style={styles.appInfoCard} intensity={30}>
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow}>
                <LinearGradient
                  colors={[withAlpha(colors.primary, 0.3), 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
              </View>
              <Ionicons name="boat" size={spacing['5xl']} color={colors.primary} />
              <Text style={styles.appName}>Boat Repair Manager</Text>
              <Text style={styles.appVersion}>Version 1.0.0</Text>
            </View>

            <Text style={styles.description}>
              Manage your boat repair customers, track jobs, document work with photos,
              and keep detailed notes all in one place.
            </Text>

            <View style={styles.features}>
              {['Customer Management', 'Job Tracking', 'Photo Documentation', 'Notes & Comments'].map(
                (feature) => (
                  <View key={feature} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={spacing.lg} color={colors.success} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                )
              )}
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CustomersScreenUpdated({ navigation }: { navigation: Pick<ScreenNavigation, 'navigate'> }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBorderOpacity = useSharedValue(0);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.boat.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.boat.model?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchCustomers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const getJobStatusCount = (customer: Customer) => {
    return customer.jobs.reduce(
      (counts, job) => {
        if (job.status === 'pending') counts.pending++;
        else if (job.status === 'in_progress') counts.inProgress++;
        else if (job.status === 'completed') counts.completed++;
        return counts;
      },
      { pending: 0, inProgress: 0, completed: 0 }
    );
  };

  const searchBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(212, 175, 55, ${searchBorderOpacity.value})`,
  }));

  const renderCustomerCard = ({ item, index }: { item: Customer; index: number }) => {
    const jobCounts = getJobStatusCount(item);
    const boatInfo = `${item.boat.year || ''} ${item.boat.make || ''} ${item.boat.model || ''}`.trim();

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(15)}>
        <PressableScale
          onPress={() => Alert.alert('Customer Details', 'Full customer management coming soon!')}
        >
          <GlassCard style={styles.customerCardOuter}>
            <View style={styles.customerHeader}>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{item.name}</Text>
                {boatInfo ? <Text style={styles.boatInfo}>{boatInfo}</Text> : null}
                {item.phone ? <Text style={styles.contactInfo}>{item.phone}</Text> : null}
              </View>
              <View style={styles.customerMeta}>
                <View style={styles.metaRow}>
                  <Ionicons name="images" size={typography.size.base} color={colors.textSecondary} />
                  <Text style={styles.metaCount}>{item.images.length}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="document-text" size={typography.size.base} color={colors.textSecondary} />
                  <Text style={styles.metaCount}>{item.notes.length}</Text>
                </View>
              </View>
            </View>

            <View style={styles.jobStatusContainer}>
              <View style={styles.jobStatus}>
                <View style={[styles.statusDot, { backgroundColor: colors.pending }]} />
                <Text style={styles.statusText}>{jobCounts.pending} Pending</Text>
              </View>
              <View style={styles.jobStatus}>
                <View style={[styles.statusDot, { backgroundColor: colors.inProgress }]} />
                <Text style={styles.statusText}>{jobCounts.inProgress} In Progress</Text>
              </View>
              <View style={styles.jobStatus}>
                <View style={[styles.statusDot, { backgroundColor: colors.completed }]} />
                <Text style={styles.statusText}>{jobCounts.completed} Completed</Text>
              </View>
            </View>

            <Text style={styles.lastActivity}>
              Last updated: {new Date(item.last_activity).toLocaleDateString()}
            </Text>
          </GlassCard>
        </PressableScale>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingPulse />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <PressableScale onPress={() => navigation.navigate('Add Customer')}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.addButton}
          >
            <Ionicons name="add" size={spacing['2xl']} color="#000" />
          </LinearGradient>
        </PressableScale>
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.4), 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerBorderGradient}
        />
      </View>

      <Animated.View style={[styles.searchOuter, searchBorderStyle]}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={spacing.xl}
            color={searchFocused ? colors.primary : colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers, boats..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              setSearchFocused(true);
              searchBorderOpacity.value = withTiming(0.6, { duration: 200 });
            }}
            onBlur={() => {
              setSearchFocused(false);
              searchBorderOpacity.value = withTiming(0, { duration: 200 });
            }}
          />
        </View>
      </Animated.View>

      {filteredCustomers.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.centerContent}>
          <View style={styles.emptyIconContainer}>
            <LinearGradient
              colors={[withAlpha(colors.primary, 0.2), 'transparent']}
              style={[StyleSheet.absoluteFill, { borderRadius: 60 }]}
            />
            <Ionicons name="boat" size={64} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No customers found' : 'No customers yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try adjusting your search' : 'Tap + to add your first customer'}
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomerCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// --- App Root ---

SplashScreen.preventAutoHideAsync();

const TAB_CONFIG = [
  { key: 0, label: 'Customers', iconActive: 'people' as const, iconInactive: 'people-outline' as const },
  { key: 1, label: 'Add', iconActive: 'person-add' as const, iconInactive: 'person-add-outline' as const },
  { key: 2, label: 'Settings', iconActive: 'settings' as const, iconInactive: 'settings-outline' as const },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = Font.useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const navigateTo = (screen: string) => {
    const screenMap: Record<string, number> = {
      'Add Customer': 1,
      'Customers': 0,
    };
    if (screen in screenMap) setCurrentTab(screenMap[screen]);
  };

  const screens: Record<number, React.ReactNode> = {
    0: <CustomersScreenUpdated navigation={{ navigate: navigateTo }} />,
    1: <AddCustomerScreen navigation={{ goBack: () => setCurrentTab(0), navigate: navigateTo }} />,
    2: <SettingsScreen />,
  };

  const handleTabPress = (tabKey: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCurrentTab(tabKey);
  };

  return (
    <LinearGradient
      colors={[colors.background, '#0D1425', '#0A1020', colors.background]}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.appContainer}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <Animated.View key={currentTab} entering={FadeIn.duration(250)} style={{ flex: 1 }}>
        {screens[currentTab] ?? screens[0]}
      </Animated.View>

      <View style={[styles.tabBarOuter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {Platform.OS === 'web' ? (
          <View style={[styles.tabBar, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            {TAB_CONFIG.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.key)}
              >
                <Ionicons
                  name={currentTab === tab.key ? tab.iconActive : tab.iconInactive}
                  size={spacing['2xl']}
                  color={currentTab === tab.key ? colors.tabBarActive : colors.tabBarInactive}
                />
                <Text style={[
                  styles.tabText,
                  { color: currentTab === tab.key ? colors.tabBarActive : colors.tabBarInactive }
                ]}>
                  {tab.label}
                </Text>
                {currentTab === tab.key && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.tabIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <BlurView intensity={40} tint="dark" style={styles.tabBar}>
            {TAB_CONFIG.map((tab) => (
              <PressableScale
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.key)}
                haptic={false}
              >
                <Ionicons
                  name={currentTab === tab.key ? tab.iconActive : tab.iconInactive}
                  size={spacing['2xl']}
                  color={currentTab === tab.key ? colors.tabBarActive : colors.tabBarInactive}
                />
                <Text style={[
                  styles.tabText,
                  { color: currentTab === tab.key ? colors.tabBarActive : colors.tabBarInactive }
                ]}>
                  {tab.label}
                </Text>
                {currentTab === tab.key && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.tabIndicator} />
                )}
              </PressableScale>
            ))}
          </BlurView>
        )}
      </View>
    </LinearGradient>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    position: 'relative',
  },
  headerBorderGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.weight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  placeholder: {
    width: spacing['3xl'],
  },
  addButton: {
    borderRadius: radius.full,
    width: spacing['4xl'],
    height: spacing['4xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchOuter: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: spacing['5xl'],
  },
  searchIcon: {
    marginRight: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.md,
  },

  // List
  listContainer: {
    padding: spacing.lg,
  },
  customerCardOuter: {
    marginBottom: spacing.lg,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  boatInfo: {
    fontSize: typography.size.base,
    color: colors.primary,
    marginBottom: 2,
  },
  contactInfo: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  customerMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaCount: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  jobStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  jobStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
    marginRight: 6,
  },
  statusText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  lastActivity: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'right',
  },

  // Center / Empty / Loading
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['4xl'],
  },
  loadingText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Scroll / Form
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionHeaderRow: {
    marginBottom: spacing.lg,
  },
  sectionAccentLine: {
    height: 2,
    borderRadius: 1,
    marginBottom: spacing.sm,
    width: '40%',
  },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  inputErrorBorder: {
    borderColor: colors.error,
  },
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.text,
    minHeight: spacing['5xl'],
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Dropdown
  dropdownButton: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: spacing['5xl'],
  },
  dropdownText: {
    fontSize: typography.size.md,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  dropdownWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  selectedOption: {
    backgroundColor: withAlpha(colors.primary, 0.125),
  },
  dropdownOptionText: {
    fontSize: typography.size.md,
    color: colors.text,
  },
  selectedOptionText: {
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },

  // Submit
  submitButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing['3xl'],
  },
  submitButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.weight.semibold,
    color: '#000',
    letterSpacing: 0.5,
  },

  // Settings
  optionCardOuter: {
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: spacing.lg,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  appInfoCard: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logoGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'absolute',
    top: -16,
  },
  appName: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  appVersion: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  description: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['2xl'],
  },
  features: {
    alignItems: 'flex-start',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureText: {
    fontSize: typography.size.base,
    color: colors.text,
    marginLeft: spacing.sm,
  },

  // Tab Bar
  tabBarOuter: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  tabText: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
    fontWeight: typography.weight.medium,
  },
  tabIndicator: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
});
