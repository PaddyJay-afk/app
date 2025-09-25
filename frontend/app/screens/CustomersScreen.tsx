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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  images: any[];
  jobs: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    created_at: string;
    updated_at: string;
  }>;
  notes: any[];
  last_activity: string;
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
    pending: '#FF9800',
    inProgress: '#2196F3',
    completed: '#4CAF50',
  }
};

export default function CustomersScreen({ navigation }: any) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.colors.pending;
      case 'in_progress': return theme.colors.inProgress;
      case 'completed': return theme.colors.completed;
      default: return theme.colors.textSecondary;
    }
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
        onPress={() => {
          setSelectedCustomer(item);
          navigation.navigate('CustomerDetail', { customer: item });
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
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
});