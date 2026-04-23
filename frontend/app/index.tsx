import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000/api';

const colors = {
  navy: '#081826',
  blue: '#1f7ae0',
  white: '#ffffff',
  light: '#f2f5f8',
  gray: '#7d8790',
  border: '#d9e1e8',
};

const urgencyOptions = ['stranded/on water', 'taking on water', 'boat unusable', 'trip planned soon', 'normal service', 'not urgent'];
const categoryOptions = [
  'no start/no crank',
  'cranks but won’t start',
  'starts then stalls',
  'rough running',
  'overheating',
  'alarm/limp mode',
  'low power/won’t plane',
  'vibration',
  'fuel issue',
  'electrical issue',
  'battery/charging',
  'steering/controls',
  'leak/taking on water',
  'maintenance',
  'winterization',
  'spring commissioning',
  'electronics install',
  'other',
];

const statusOptions = ['New', 'Reviewed', 'Contacted', 'Scheduled', 'Converted', 'Closed', 'Spam'];

type IntakeData = Record<string, any>;

const blankIntake: IntakeData = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  preferredContactMethod: 'call',
  bestCallbackTime: '',
  customerType: 'new',
  boatYear: '',
  boatMake: '',
  boatModel: '',
  boatLocationType: 'on trailer',
  boatLocationDetails: '',
  hullOrRegistration: '',
  engineType: 'unknown',
  engineBrand: 'unknown',
  engineModel: '',
  engineHours: '',
  engineCount: 'single',
  problemCategory: categoryOptions[0],
  issueDescription: '',
  startTimeDescription: '',
  precedingEvent: '',
  engineRuns: '',
  alarmsOrCodes: '',
  recentService: '',
  fuelInfo: '',
  batteryInfo: '',
  urgency: 'normal service',
  disclaimerAccepted: false,
  uploadedFiles: [],
  honeypot: '',
};

const LabeledInput = ({ label, value, onChangeText, placeholder = '' }: any) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} style={styles.input} placeholderTextColor={colors.gray} />
  </View>
);

const SelectButtons = ({ label, value, options, onChange }: any) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.pillWrap}>
      {options.map((option: string) => (
        <TouchableOpacity key={option} onPress={() => onChange(option)} style={[styles.pill, value === option && styles.pillActive]}>
          <Text style={[styles.pillText, value === option && styles.pillTextActive]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

export default function Index() {
  const [mode, setMode] = useState<'start' | 'intake' | 'admin'>('start');
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<IntakeData>(blankIntake);
  const [config, setConfig] = useState<any>({ disclaimerText: 'For immediate emergencies, call 911 or local marine emergency services.' });
  const [confirmation, setConfirmation] = useState<any>(null);

  const [email, setEmail] = useState('owner@lakeready.local');
  const [password, setPassword] = useState('LakeReady123!');
  const [token, setToken] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [digest, setDigest] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [adminTab, setAdminTab] = useState<'dashboard' | 'digest' | 'settings'>('dashboard');
  const { width } = useWindowDimensions();

  const isMobile = width < 900;

  const fetchPublic = async () => {
    const res = await fetch(`${API_BASE_URL}/public/config`);
    setConfig(await res.json());
  };

  useEffect(() => {
    fetchPublic();
  }, []);

  const update = (key: string, value: any) => setIntake((p) => ({ ...p, [key]: value }));

  const pickUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const fileType = asset.mimeType || 'application/octet-stream';
    const fileUrl = asset.base64 ? `data:${fileType};base64,${asset.base64}` : asset.uri;
    update('uploadedFiles', [...intake.uploadedFiles, { fileName: asset.fileName || 'upload', fileType, fileUrl, notes: '' }]);
  };

  const submitIntake = async () => {
    const res = await fetch(`${API_BASE_URL}/public/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intake),
    });
    if (!res.ok) {
      Alert.alert('Submission failed', (await res.json()).detail || 'Please try again.');
      return;
    }
    const data = await res.json();
    setConfirmation(data);
    setStep(8);
  };

  const login = async () => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return Alert.alert('Login failed', 'Invalid credentials');
    const data = await res.json();
    setToken(data.token);
    setMode('admin');
  };

  const loadRequests = async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/admin/service-requests`, { headers: { Authorization: `Bearer ${token}` } });
    setRequests(await res.json());
  };

  const loadDigest = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/morning-digest`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setDigest(data.digestText || 'No requests since previous close.');
  };

  const loadSettings = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } });
    setSettings(await res.json());
  };

  useEffect(() => {
    if (mode === 'admin') {
      loadRequests();
      loadDigest();
      loadSettings();
    }
  }, [mode, token]);

  const dashboardStats = useMemo(() => {
    const count = (fn: (row: any) => boolean) => requests.filter(fn).length;
    return {
      New: count((r) => r.status === 'New'),
      High: count((r) => r.priorityScore >= 80),
      Existing: count((r) => r.customerType === 'existing'),
      Contacted: count((r) => r.status === 'Contacted'),
      Converted: count((r) => r.status === 'Converted'),
      Closed: count((r) => r.status === 'Closed'),
    };
  }, [requests]);

  const updateStatus = async (status: string) => {
    if (!activeRequest) return;
    await fetch(`${API_BASE_URL}/admin/service-requests/${activeRequest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, internalNotes: activeRequest.internalNotes || '' }),
    });
    await loadRequests();
  };

  const updateNotes = async () => {
    if (!activeRequest) return;
    await fetch(`${API_BASE_URL}/admin/service-requests/${activeRequest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: activeRequest.status, internalNotes: activeRequest.internalNotes || '' }),
    });
    await loadRequests();
    Alert.alert('Saved', 'Internal notes updated.');
  };

  const saveSettings = async () => {
    await fetch(`${API_BASE_URL}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    });
    Alert.alert('Saved', 'Settings updated.');
  };

  const renderIntake = () => {
    const sections = [
      <View key="landing">
        <Text style={styles.hero}>Start Your Service Request</Text>
        <Text style={styles.body}>LakeReady Intake securely captures your after-hours marine service request for next business-hour review.</Text>
        <Text style={styles.warning}>Emergency Disclaimer: This form does not provide emergency response. If there is immediate danger, contact 911 or marine emergency services.</Text>
      </View>,
      <View key="customer">
        <LabeledInput label="Full name" value={intake.customerName} onChangeText={(v: string) => update('customerName', v)} />
        <LabeledInput label="Phone number" value={intake.customerPhone} onChangeText={(v: string) => update('customerPhone', v)} />
        <LabeledInput label="Email" value={intake.customerEmail} onChangeText={(v: string) => update('customerEmail', v)} />
        <SelectButtons label="Preferred contact" value={intake.preferredContactMethod} options={['call', 'text', 'email']} onChange={(v: string) => update('preferredContactMethod', v)} />
        <LabeledInput label="Best callback time" value={intake.bestCallbackTime} onChangeText={(v: string) => update('bestCallbackTime', v)} />
        <SelectButtons label="Customer type" value={intake.customerType} options={['new', 'existing']} onChange={(v: string) => update('customerType', v)} />
      </View>,
      <View key="boat">
        <LabeledInput label="Boat year" value={intake.boatYear} onChangeText={(v: string) => update('boatYear', v)} />
        <LabeledInput label="Boat make" value={intake.boatMake} onChangeText={(v: string) => update('boatMake', v)} />
        <LabeledInput label="Boat model" value={intake.boatModel} onChangeText={(v: string) => update('boatModel', v)} />
        <SelectButtons label="Boat location type" value={intake.boatLocationType} options={['on trailer', 'in slip', 'on lift', 'marina', 'customer home', 'stranded/on water', 'other']} onChange={(v: string) => update('boatLocationType', v)} />
        <LabeledInput label="Location details / marina" value={intake.boatLocationDetails} onChangeText={(v: string) => update('boatLocationDetails', v)} />
        <LabeledInput label="Hull ID/registration (optional)" value={intake.hullOrRegistration} onChangeText={(v: string) => update('hullOrRegistration', v)} />
      </View>,
      <View key="engine">
        <SelectButtons label="Engine type" value={intake.engineType} options={['inboard', 'sterndrive', 'outboard', 'jet boat/PWC', 'unknown']} onChange={(v: string) => update('engineType', v)} />
        <SelectButtons label="Engine brand" value={intake.engineBrand} options={['Mercury', 'MerCruiser', 'PCM', 'Volvo Penta', 'Indmar', 'Ilmor', 'Yamaha', 'Honda', 'Sea-Doo/Rotax', 'other', 'unknown']} onChange={(v: string) => update('engineBrand', v)} />
        <LabeledInput label="Engine model / horsepower" value={intake.engineModel} onChangeText={(v: string) => update('engineModel', v)} />
        <LabeledInput label="Engine hours" value={intake.engineHours} onChangeText={(v: string) => update('engineHours', v)} />
        <SelectButtons label="Engine count" value={intake.engineCount} options={['single', 'twin']} onChange={(v: string) => update('engineCount', v)} />
      </View>,
      <View key="problem">
        <SelectButtons label="Problem category" value={intake.problemCategory} options={categoryOptions} onChange={(v: string) => update('problemCategory', v)} />
        <LabeledInput label="Description" value={intake.issueDescription} onChangeText={(v: string) => update('issueDescription', v)} />
        <LabeledInput label="When did it start?" value={intake.startTimeDescription} onChangeText={(v: string) => update('startTimeDescription', v)} />
        <LabeledInput label="What happened right before?" value={intake.precedingEvent} onChangeText={(v: string) => update('precedingEvent', v)} />
        <LabeledInput label="Does engine run currently?" value={intake.engineRuns} onChangeText={(v: string) => update('engineRuns', v)} />
        <LabeledInput label="Alarms/lights/fault codes" value={intake.alarmsOrCodes} onChangeText={(v: string) => update('alarmsOrCodes', v)} />
        <LabeledInput label="Recent service" value={intake.recentService} onChangeText={(v: string) => update('recentService', v)} />
        <LabeledInput label="Fuel info (optional)" value={intake.fuelInfo} onChangeText={(v: string) => update('fuelInfo', v)} />
        <LabeledInput label="Battery info (optional)" value={intake.batteryInfo} onChangeText={(v: string) => update('batteryInfo', v)} />
      </View>,
      <View key="urgency">
        <SelectButtons label="Urgency" value={intake.urgency} options={urgencyOptions} onChange={(v: string) => update('urgency', v)} />
        <TouchableOpacity onPress={() => update('disclaimerAccepted', !intake.disclaimerAccepted)} style={styles.checkboxRow}>
          <Text style={styles.checkbox}>{intake.disclaimerAccepted ? '☑' : '☐'}</Text>
          <Text style={styles.body}>I understand this form does not provide a diagnosis, estimate, appointment guarantee, or emergency response.</Text>
        </TouchableOpacity>
      </View>,
      <View key="upload">
        <TouchableOpacity onPress={pickUpload} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Upload Photo / Video</Text></TouchableOpacity>
        {intake.uploadedFiles.map((f: any, idx: number) => <Text key={idx} style={styles.body}>• {f.fileName} ({f.fileType})</Text>)}
      </View>,
      <View key="review">
        <Text style={styles.hero}>Review and Submit</Text>
        <Text style={styles.body}>{JSON.stringify(intake, null, 2)}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={submitIntake}><Text style={styles.primaryBtnText}>Submit Request</Text></TouchableOpacity>
      </View>,
      <View key="confirm">
        <Text style={styles.hero}>Your request has been received.</Text>
        <Text style={styles.body}>Request ID: {confirmation?.requestNumber}</Text>
        <Text style={styles.warning}>{config.disclaimerText}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { setMode('start'); setStep(0); setIntake(blankIntake); }}><Text style={styles.primaryBtnText}>Done</Text></TouchableOpacity>
      </View>,
    ];

    return (
      <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>{sections[step]}</View>
          {step < 8 && (
            <View style={styles.navRow}>
              {step > 0 && <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep((s) => s - 1)}><Text>Back</Text></TouchableOpacity>}
              {step < 7 && <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep((s) => s + 1)}><Text style={styles.primaryBtnText}>{step === 0 ? 'Start Intake' : 'Continue'}</Text></TouchableOpacity>}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderDashboard = () => (
    <View style={{ flex: 1, flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
      <View style={[styles.card, { flex: isMobile ? 0 : 1 }]}>
        <Text style={styles.section}>Dashboard</Text>
        <View style={styles.pillWrap}>{Object.entries(dashboardStats).map(([k, v]) => <View key={k} style={styles.stat}><Text style={styles.statTitle}>{k}</Text><Text style={styles.statValue}>{String(v)}</Text></View>)}</View>
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => setActiveRequest(item)}>
              <Text style={styles.rowTitle}>{item.requestNumber} • {item.customerName}</Text>
              <Text style={styles.rowMeta}>{item.customerPhone} | {item.boatMake} {item.boatModel} | {item.engineBrand} | {item.problemCategory}</Text>
              <Text style={styles.rowMeta}>Urgency: {item.urgency} • Status: {item.status}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {!!activeRequest && (
        <View style={[styles.card, { flex: 1.2 }]}>
          <Text style={styles.section}>Request Detail</Text>
          <Text style={styles.body}>{activeRequest.aiSummary}</Text>
          <Text style={styles.body}>Recommended category: {activeRequest.problemCategory}</Text>
          <Text style={styles.body}>Customer: {activeRequest.customerName} / {activeRequest.customerPhone} / {activeRequest.customerEmail}</Text>
          <Text style={styles.body}>Boat: {activeRequest.boatYear} {activeRequest.boatMake} {activeRequest.boatModel} ({activeRequest.boatLocationType})</Text>
          <Text style={styles.body}>Engine: {activeRequest.engineType} {activeRequest.engineBrand} {activeRequest.engineModel}</Text>
          <Text style={styles.body}>Issue: {activeRequest.issueDescription}</Text>
          <Text style={styles.body}>Files: {(activeRequest.files || []).length}</Text>
          <SelectButtons label="Status" value={activeRequest.status} options={statusOptions} onChange={(v: string) => { setActiveRequest({ ...activeRequest, status: v }); updateStatus(v); }} />
          <LabeledInput label="Internal notes" value={activeRequest.internalNotes || ''} onChangeText={(v: string) => setActiveRequest({ ...activeRequest, internalNotes: v })} />
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { navigator.clipboard?.writeText(activeRequest.aiSummary); Alert.alert('Copied', 'Summary copied.'); }}><Text>Copy summary</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Placeholder', 'Email action placeholder')}><Text>Email customer</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Placeholder', 'Text customer placeholder')}><Text>Text customer</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Placeholder', 'Export PDF placeholder')}><Text>Export PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={updateNotes}><Text style={styles.primaryBtnText}>Mark as contacted</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderAdmin = () => (
    <SafeAreaView style={styles.page}>
      <View style={styles.adminHeader}>
        {['dashboard', 'digest', 'settings'].map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setAdminTab(tab as any)} style={[styles.secondaryBtn, adminTab === tab && { borderColor: colors.blue }]}>
            <Text>{tab}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setMode('start'); setToken(''); }}><Text>Logout</Text></TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        {adminTab === 'dashboard' && renderDashboard()}
        {adminTab === 'digest' && (
          <ScrollView style={styles.card}>
            <Text style={styles.section}>Morning Digest</Text>
            <Text style={styles.body}>{digest}</Text>
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigator.clipboard?.writeText(digest)}><Text style={styles.primaryBtnText}>Copy to Clipboard</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Placeholder', 'Email digest placeholder')}><Text>Email Digest Placeholder</Text></TouchableOpacity>
            </View>
          </ScrollView>
        )}
        {adminTab === 'settings' && settings && (
          <ScrollView style={styles.card}>
            <Text style={styles.section}>Settings</Text>
            <LabeledInput label="Shop name" value={settings.name} onChangeText={(v: string) => setSettings({ ...settings, name: v })} />
            <LabeledInput label="Logo URL" value={settings.logoUrl || ''} onChangeText={(v: string) => setSettings({ ...settings, logoUrl: v })} />
            <LabeledInput label="Business hours" value={settings.businessHours || ''} onChangeText={(v: string) => setSettings({ ...settings, businessHours: v })} />
            <LabeledInput label="Service email" value={settings.serviceEmail || ''} onChangeText={(v: string) => setSettings({ ...settings, serviceEmail: v })} />
            <LabeledInput label="Notification phone" value={settings.notificationPhone || ''} onChangeText={(v: string) => setSettings({ ...settings, notificationPhone: v })} />
            <LabeledInput label="Intake link" value={`${API_BASE_URL.replace('/api', '')}/`} onChangeText={() => {}} />
            <LabeledInput label="Emergency disclaimer" value={settings.disclaimerText || ''} onChangeText={(v: string) => setSettings({ ...settings, disclaimerText: v })} />
            <LabeledInput label="Category customization (comma-separated)" value={(settings.categoryCustomization || []).join(',')} onChangeText={(v: string) => setSettings({ ...settings, categoryCustomization: v.split(',').map((x: string) => x.trim()).filter(Boolean) })} />
            <LabeledInput label="Engine brand customization (comma-separated)" value={(settings.engineBrandCustomization || []).join(',')} onChangeText={(v: string) => setSettings({ ...settings, engineBrandCustomization: v.split(',').map((x: string) => x.trim()).filter(Boolean) })} />
            <LabeledInput label="Webhook URL" value={settings.webhookUrl || ''} onChangeText={(v: string) => setSettings({ ...settings, webhookUrl: v })} />
            <TouchableOpacity style={styles.primaryBtn} onPress={saveSettings}><Text style={styles.primaryBtnText}>Save Settings</Text></TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );

  if (mode === 'start') {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.logo}>[ Shop Logo ]</Text>
            <Text style={styles.hero}>LakeReady Intake</Text>
            <Text style={styles.body}>After-hours marine service intake for repair shops, marinas, and mobile technicians around Lake Anna, VA.</Text>
            <Text style={styles.warning}>{config.disclaimerText}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { setMode('intake'); setStep(0); }}><Text style={styles.primaryBtnText}>Start Intake</Text></TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Text style={styles.section}>Shop Login</Text>
            <LabeledInput label="Email" value={email} onChangeText={setEmail} />
            <LabeledInput label="Password" value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.primaryBtn} onPress={login}><Text style={styles.primaryBtnText}>Login</Text></TouchableOpacity>
            <Text style={styles.body}>Forgot password flow placeholder supported in v1 UI.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'intake') return renderIntake();
  return renderAdmin();
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy },
  container: { gap: 16, padding: 18 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  logo: { color: colors.gray, marginBottom: 8 },
  hero: { fontSize: 28, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  section: { fontSize: 20, fontWeight: '700', color: colors.navy, marginBottom: 10 },
  body: { color: '#213240', marginBottom: 8 },
  warning: { color: '#b03a2e', fontWeight: '600', marginBottom: 12 },
  field: { marginBottom: 10 },
  label: { color: colors.navy, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: colors.light, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.navy },
  primaryBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  primaryBtnText: { color: colors.white, fontWeight: '700' },
  secondaryBtn: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  navRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.white },
  pillActive: { backgroundColor: '#e6f2ff', borderColor: colors.blue },
  pillText: { color: colors.navy, fontSize: 12 },
  pillTextActive: { color: colors.blue, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'flex-start' },
  checkbox: { fontSize: 20 },
  adminHeader: { flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' },
  stat: { backgroundColor: colors.light, borderRadius: 8, padding: 8, minWidth: 88, borderWidth: 1, borderColor: colors.border },
  statTitle: { color: colors.gray, fontSize: 12 },
  statValue: { color: colors.navy, fontWeight: '700', fontSize: 18 },
  row: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 10 },
  rowTitle: { fontWeight: '700', color: colors.navy },
  rowMeta: { color: '#31495d', fontSize: 12, marginTop: 2 },
});
