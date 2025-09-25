import React, { useState, useCallback, useMemo } from 'react';
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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
    pending: '#FF9800',
    inProgress: '#2196F3',
    completed: '#4CAF50',
    tabBarActive: '#D4AF37',
    tabBarInactive: '#666666',
  }
};

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

// CustomersScreen Component
function CustomersScreen({ navigation }: any) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCustomers();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const getJobStatusCount = (customer: Customer) => {
    const pending = customer.jobs.filter(job => job.status === 'pending').length;
    const inProgress = customer.jobs.filter(job => job.status === 'in_progress').length;
    const completed = customer.jobs.filter(job => job.status === 'completed').length;
    return { pending, inProgress, completed };
  };

  const renderCustomerCard = ({ item }: { item: Customer }) => {
    const jobCounts = getJobStatusCount(item);
    const boatInfo = `${item.boat.year || ''} ${item.boat.make || ''} ${item.boat.model || ''}`.trim();

    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => navigation.navigate('CustomerDetail', { customer: item, onUpdate: fetchCustomers })}
        activeOpacity={0.7}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{item.name}</Text>
            {boatInfo && <Text style={styles.boatInfo}>{boatInfo}</Text>}
            {item.phone && <Text style={styles.contactInfo}>{item.phone}</Text>}
          </View>
          <View style={styles.customerMeta}>
            <Text style={styles.imageCount}>
              <Ionicons name="images" size={14} color={theme.colors.textSecondary} />
              {' '}{item.images.length}
            </Text>
            <Text style={styles.noteCount}>
              <Ionicons name="document-text" size={14} color={theme.colors.textSecondary} />
              {' '}{item.notes.length}
            </Text>
          </View>
        </View>
        
        <View style={styles.jobStatusContainer}>
          <View style={styles.jobStatus}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.pending }]} />
            <Text style={styles.statusText}>{jobCounts.pending} Pending</Text>
          </View>
          <View style={styles.jobStatus}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.inProgress }]} />
            <Text style={styles.statusText}>{jobCounts.inProgress} In Progress</Text>
          </View>
          <View style={styles.jobStatus}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.completed }]} />
            <Text style={styles.statusText}>{jobCounts.completed} Completed</Text>
          </View>
        </View>

        <Text style={styles.lastActivity}>
          Last updated: {new Date(item.last_activity).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('Add Customer')}
        >
          <Ionicons name="add" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers, boats..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredCustomers.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="boat" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No customers found' : 'No customers yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try adjusting your search' : 'Add your first customer to get started'}
          </Text>
        </View>
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
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// AddCustomerScreen Component
function AddCustomerScreen({ navigation }: any) {
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

// SettingsScreen Component  
function SettingsScreen() {
  const settingsOptions = [
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

  const renderSettingOption = (option: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.optionCard}
      onPress={option.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={option.icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          {settingsOptions.map(renderSettingOption)}
        </View>

        <View style={styles.appInfo}>
          <View style={styles.logoContainer}>
            <Ionicons name="boat" size={48} color={theme.colors.primary} />
            <Text style={styles.appName}>Boat Repair Manager</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
          </View>
          
          <Text style={styles.description}>
            Manage your boat repair customers, track jobs, document work with photos, 
            and keep detailed notes all in one place.
          </Text>
          
          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.featureText}>Customer Management</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.featureText}>Job Tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.featureText}>Photo Documentation</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.featureText}>Notes & Comments</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Customer Detail Screen - This will be created next
function CustomerDetailScreen({ route, navigation }: any) {
  const { customer } = route.params;
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{customer.name}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.centerContent}>
        <Text style={styles.emptyTitle}>Customer Details</Text>
        <Text style={styles.emptySubtitle}>Coming soon - Full customer management with images, jobs, and notes</Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState(0);

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 0:
        return <CustomersScreen navigation={{ navigate: (screen: string) => {
          if (screen === 'Add Customer') setCurrentTab(1);
        }}} />;
      case 1:
        return <AddCustomerScreen navigation={{ 
          goBack: () => setCurrentTab(0),
          navigate: (screen: string) => {
            if (screen === 'Customers') setCurrentTab(0);
          }
        }} />;
      case 2:
        return <SettingsScreen />;
      default:
        return <CustomersScreen navigation={{ navigate: (screen: string) => {
          if (screen === 'Add Customer') setCurrentTab(1);
        }}} />;
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={theme.colors.background} />
      <View style={styles.container}>
        {renderCurrentScreen()}
        
        {/* Custom Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, currentTab === 0 && styles.activeTab]}
            onPress={() => setCurrentTab(0)}
          >
            <Ionicons 
              name={currentTab === 0 ? 'people' : 'people-outline'} 
              size={24} 
              color={currentTab === 0 ? theme.colors.tabBarActive : theme.colors.tabBarInactive} 
            />
            <Text style={[
              styles.tabText, 
              { color: currentTab === 0 ? theme.colors.tabBarActive : theme.colors.tabBarInactive }
            ]}>
              Customers
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, currentTab === 1 && styles.activeTab]}
            onPress={() => setCurrentTab(1)}
          >
            <Ionicons 
              name={currentTab === 1 ? 'person-add' : 'person-add-outline'} 
              size={24} 
              color={currentTab === 1 ? theme.colors.tabBarActive : theme.colors.tabBarInactive} 
            />
            <Text style={[
              styles.tabText, 
              { color: currentTab === 1 ? theme.colors.tabBarActive : theme.colors.tabBarInactive }
            ]}>
              Add Customer
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, currentTab === 2 && styles.activeTab]}
            onPress={() => setCurrentTab(2)}
          >
            <Ionicons 
              name={currentTab === 2 ? 'settings' : 'settings-outline'} 
              size={24} 
              color={currentTab === 2 ? theme.colors.tabBarActive : theme.colors.tabBarInactive} 
            />
            <Text style={[
              styles.tabText, 
              { color: currentTab === 2 ? theme.colors.tabBarActive : theme.colors.tabBarInactive }
            ]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaProvider>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  boatInfo: {
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  contactInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  customerMeta: {
    alignItems: 'flex-end',
  },
  imageCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  noteCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  jobStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  lastActivity: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  appInfo: {
    padding: 20,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  features: {
    alignItems: 'flex-start',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
  },
});